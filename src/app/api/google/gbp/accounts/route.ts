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

    // 1) Accounts
    const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const accJson = await accRes.json()
    if (!accRes.ok) {
      return NextResponse.json({ error: 'accounts_api_failed', detail: accJson }, { status: accRes.status })
    }

    const accounts = accJson.accounts ?? []

    // 2) For each account, list locations via Business Information API (readMask is REQUIRED)
    const readMask = 'name,title,categories,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile'
    const accountWithLocations = []
    for (const acct of accounts) {
      const name = acct.name // e.g. accounts/123...
      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${name}/locations?readMask=${encodeURIComponent(readMask)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const locJson = await locRes.json()
      const locations = locRes.ok ? (locJson.locations ?? []) : []
      accountWithLocations.push({
        name,
        accountName: acct.accountName,
        type: acct.type,
        verificationState: acct.verificationState,
        vettedState: acct.vettedState,
        locations: locations.map((l: any) => ({
          name: l.name,                     // "locations/2765..."
          title: l.title,
          address: l.storefrontAddress ? {
            addressLines: l.storefrontAddress.addressLines ?? [],
            locality: l.storefrontAddress.locality,
            administrativeArea: l.storefrontAddress.administrativeArea,
            postalCode: l.storefrontAddress.postalCode,
            countryCode: l.storefrontAddress.countryCode,
          } : null,
          phone: l.phoneNumbers?.primaryPhone ?? '',
          website: l.websiteUri ?? '',
          category: l.categories?.primaryCategory?.displayName ?? '',
        })),
      })
    }

    return NextResponse.json({ accounts: accountWithLocations })
  } catch (e: any) {
    console.error('GBP accounts route error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}