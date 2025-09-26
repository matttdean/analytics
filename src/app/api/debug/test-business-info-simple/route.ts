export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

async function getAccessToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  const access = decrypt(
    data.access_token_cipher,
    Buffer.from(data.access_token_iv, 'base64'),
    Buffer.from(data.access_token_tag, 'base64')
  )
  const refresh = decrypt(
    data.refresh_token_cipher,
    Buffer.from(data.refresh_token_iv, 'base64'),
    Buffer.from(data.refresh_token_tag, 'base64')
  )
  let accessToken = access
  const expiresAt = data.expiry ? Date.parse(data.expiry) : 0

  if (!accessToken || (expiresAt && Date.now() > expiresAt - 60_000)) {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }).toString()
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const j = await r.json()
    if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
    accessToken = j.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }
  return accessToken
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await getAccessToken(supabase, user.id)
    const locationId = 'locations/2765560021277676673'

    // Test different readMask options
    const readMaskOptions = [
      'title',
      'title,categories',
      'title,categories,storefrontAddress',
      'title,categories,storefrontAddress,phoneNumbers',
      'title,categories,storefrontAddress,phoneNumbers,websiteUri',
      'title,categories,storefrontAddress,phoneNumbers,websiteUri,regularHours',
      'title,categories,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile'
    ]

    const results = []
    for (const readMask of readMaskOptions) {
      try {
        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=${encodeURIComponent(readMask)}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        
        let data: any
        let isJson = true
        try {
          data = await res.json()
        } catch (e) {
          isJson = false
          data = await res.text()
        }
        
        results.push({
          readMask,
          status: res.status,
          ok: res.ok,
          isJson,
          hasData: isJson && (data.title || data.categories || data.storefrontAddress),
          response: isJson ? data : data.substring(0, 200)
        })
      } catch (e) {
        results.push({
          readMask,
          error: e?.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      locationId,
      accessToken: accessToken?.substring(0, 20) + '...',
      results
    })

  } catch (e: any) {
    console.error('Test error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}

