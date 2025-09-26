export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

async function getTokens(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  let access: string | undefined
  try {
    access = decrypt(
      data.access_token_cipher,
      Buffer.from(data.access_token_iv, 'base64'),
      Buffer.from(data.access_token_tag, 'base64')
    )
  } catch {}

  let refresh: string | undefined
  try {
    refresh = decrypt(
      data.refresh_token_cipher,
      Buffer.from(data.refresh_token_iv, 'base64'),
      Buffer.from(data.refresh_token_tag, 'base64')
    )
  } catch {}

  const expiresAt = data.expiry ? Date.parse(data.expiry) : 0
  return { access, refresh, expiresAt }
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString()

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
  return j as { access_token: string; expires_in: number }
}

async function ensureAccessToken(supabase: any, userId: string) {
  const { access, refresh, expiresAt } = await getTokens(supabase, userId)
  let accessToken = access

  if (!accessToken) {
    if (!refresh) throw new Error('no_access_token')
    const ref = await refreshAccessToken(refresh)
    accessToken = ref.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (ref.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  } else if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
    const ref = await refreshAccessToken(refresh)
    accessToken = ref.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (ref.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }

  if (!accessToken) throw new Error('no_access_token')
  return accessToken
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await ensureAccessToken(supabase, user.id)

    // Test Business Information API with real location
    const locationId = 'locations/2765560021277676673'
    const infoRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=title,primaryCategory,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    
    const infoJson = await infoRes.json()

    return NextResponse.json({
      success: true,
      businessInfoApi: {
        status: infoRes.status,
        ok: infoRes.ok,
        locationId,
        rawResponse: infoJson,
        extractedData: {
          name: infoJson?.title || 'No title',
          category: infoJson?.primaryCategory?.displayName || 'No category',
          address: infoJson?.storefrontAddress ? [
            infoJson.storefrontAddress.addressLines?.join(' '),
            infoJson.storefrontAddress.locality,
            infoJson.storefrontAddress.administrativeArea,
            infoJson.storefrontAddress.postalCode,
          ].filter(Boolean).join(', ') : 'No address',
          phone: infoJson?.phoneNumbers?.primaryPhone || 'No phone',
          website: infoJson?.websiteUri || 'No website',
          hours: infoJson?.regularHours?.periods || [],
          description: infoJson?.profile?.description || 'No description'
        }
      }
    })

  } catch (e: any) {
    console.error('Business Info test error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
