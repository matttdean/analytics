import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

// optional crypto (if you stored *_enc)
let decrypt: ((val: any) => string) | null = null
async function getDecrypt() {
  if (decrypt) return decrypt
  try {
    const mod: any = await import('@/lib/crypto')
    decrypt = mod.decrypt as (val: any) => string
  } catch { /* no crypto module */ }
  return decrypt
}

async function readToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token, access_token_enc, refresh_token, refresh_token_enc, expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error('missing_google_tokens')

  const dec = await getDecrypt()

  const decryptMaybe = (enc?: string | null) => {
    if (!enc) return undefined
    if (!dec) return enc // plaintext in *_enc (or no decrypt module)
    let parsed: any = enc
    try { parsed = JSON.parse(enc) } catch { /* was plain string enc */ }
    try { return dec(parsed) } catch { return enc }
  }

  let access = data.access_token ?? decryptMaybe(data.access_token_enc)
  let refresh = data.refresh_token ?? decryptMaybe(data.refresh_token_enc)
  const expiresAt = data.expires_at ? Date.parse(data.expires_at) : 0

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
  if (!r.ok) {
    throw new Error(`refresh_failed:${j?.error || r.status}`)
  }
  return j as { access_token: string; expires_in: number; token_type: string }
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Determine property ID (prefer saved connection, else ?property=123)
    const url = new URL(req.url)
    let property = url.searchParams.get('property') || undefined

    if (!property) {
      const { data: conn } = await supabase
        .from('ga4_connections')     // <-- if your table name differs, change this
        .select('property_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      property = (conn as any)?.property_id
    }

    if (!property) {
      return NextResponse.json({ error: 'no_property_configured' }, { status: 400 })
    }

    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    let accessToken = access as string

    // refresh if expiring (buffer 60s)
    if (!accessToken) throw new Error('no_access_token')
    if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
      const refreshed = await refreshAccessToken(refresh as string)
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
      // persist the new access token (plaintext or *_enc; we just store plaintext here)
      await supabase
        .from('google_oauth_tokens')
        .update({ access_token: accessToken, expires_at: newExpiresAt })
        .eq('user_id', user.id)
    }

    // GA4 Realtime API (last ~30 minutes)
    const resp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${property}:runRealtimeReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    )

    const json = await resp.json()
    if (!resp.ok) {
      return NextResponse.json({ error: 'ga_realtime_failed', detail: json }, { status: resp.status })
    }

    const value =
      Number(json?.rows?.[0]?.metricValues?.[0]?.value ?? 0)

    return NextResponse.json({ activeUsers: value, property })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
