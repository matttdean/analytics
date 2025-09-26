import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

function normalizePropertyId(raw?: string) {
  if (!raw) throw new Error('missing_property')
  const id = raw.startsWith('properties/') ? raw : `properties/${raw}`
  const num = id.split('/')[1]
  if (!/^\d+$/.test(num)) throw new Error(`invalid_property:${raw}`)
  return id
}

async function readToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error('missing_google_tokens')

  try {
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
    const expiresAt = data.expiry ? Date.parse(data.expiry) : 0
    return { access, refresh, expiresAt }
  } catch (decryptError) {
    console.error('Token decryption failed:', decryptError)
    throw new Error('token_decryption_failed')
  }
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
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await r.text()
  let j: any = {}
  try { j = text ? JSON.parse(text) : {} } catch {}
  if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}:${text?.slice(0,200)}`)
  return j as { access_token: string; expires_in: number; token_type: string }
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Determine property: ?property=... OR stored default
    const url = new URL(req.url)
    let propertyRaw = url.searchParams.get('property') || undefined
    if (!propertyRaw) {
      const { data: conn } = await supabase
        .from('ga4_connections')
        .select('property_id')
        .eq('user_id', user.id)
        .maybeSingle()
      propertyRaw = conn?.property_id
    }
    const property = normalizePropertyId(propertyRaw)

    // Load/refresh tokens
    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    let accessToken = access as string
    if (!accessToken) throw new Error('no_access_token')

    // refresh if near expiry (60s buffer)
    if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
      const refreshed = await refreshAccessToken(refresh as string)
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()

      // persist updated access token (ignore failure silently, but log)
      try {
        const { encrypt } = await import('@/lib/crypto')
        const encA = encrypt(refreshed.access_token)
        const { error: upErr } = await supabase
          .from('google_oauth_tokens')
          .update({
            access_token_cipher: encA.cipher,
            access_token_iv: encA.iv.toString('base64'),
            access_token_tag: encA.tag.toString('base64'),
            // remove these if not real columns in your schema:
            // access_iv: encA.iv.toString('base64'),
            // access_tag: encA.tag.toString('base64'),
            expiry: newExpiresAt
          })
          .eq('user_id', user.id)
        if (upErr) console.warn('token update failed:', upErr)
      } catch (e) {
        console.warn('token update threw:', e)
      }
    }

    // Call GA4 Realtime (v1beta)
    const resp = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${property}:runRealtimeReport`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics: [{ name: 'activeUsers' }],
        }),
      }
    )

    const bodyText = await resp.text()
    let json: any = {}
    try { json = bodyText ? JSON.parse(bodyText) : {} } catch { /* HTML or plain text */ }

    if (!resp.ok) {
      console.error('GA4 realtime API error:', resp.status, bodyText?.slice(0, 500))
      return NextResponse.json(
        { error: 'ga_realtime_failed', status: resp.status, message: json?.error?.message || bodyText },
        { status: resp.status }
      )
    }

    const value = Number(json?.rows?.[0]?.metricValues?.[0]?.value ?? 0)
    return NextResponse.json({ activeUsers: value, property })
  } catch (e: any) {
    console.error('Realtime endpoint error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
