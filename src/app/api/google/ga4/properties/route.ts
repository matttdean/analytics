export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

function looksLikeGoogleAccess(t?: string) {
  if (!t) return false
  if (t.startsWith('ya29.')) return true
  return t.length > 20 && !/\s/.test(t)
}

async function readRow(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select(`
      access_token_cipher, access_token_iv, access_token_tag,
      refresh_token_cipher, refresh_token_iv, refresh_token_tag,
      expires_at, expiry, scope
    `)
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('no_token_row')
  return data
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
  return j as { access_token: string; expires_in: number; token_type: string }
}

async function persistNewAccessToken(
  supabase: any,
  userId: string,
  accessToken: string,
  expiresIn = 3600
) {
  const nowISO = new Date().toISOString()
  const expISO = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString()

  const out = encrypt(accessToken)
  const ivB64 = out.iv.toString('base64')
  const tagB64 = out.tag.toString('base64')
  
  await supabase.from('google_oauth_tokens').update({
    access_token_cipher: out.cipher,
    access_token_iv: ivB64,
    access_token_tag: tagB64,
    access_iv: ivB64,    // mirror bytea columns for compatibility
    access_tag: tagB64,
    expires_at: expISO,
    expiry: expISO,
    updated_at: nowISO,
  } as any).eq('user_id', userId)
}

async function callAdminAPI(accessToken: string) {
  const r = await fetch(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200',
    { headers: { authorization: `Bearer ${accessToken}` } }
  )
  const json = await r.json()
  return { ok: r.ok, status: r.status, json }
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const row = await readRow(supabase, user.id)

    // 1) Try to decrypt ACCESS token using text columns
    let access: string | undefined
    try {
      access = decrypt(
        row.access_token_cipher,
        Buffer.from(row.access_token_iv, 'base64'),
        Buffer.from(row.access_token_tag, 'base64')
      )
    } catch (e) {
      console.error('Failed to decrypt access token:', e)
      access = undefined
    }

    // 2) If access unusable, try to decrypt REFRESH and mint a new access
    if (!looksLikeGoogleAccess(access)) {
      let refresh: string | undefined
      try {
        refresh = decrypt(
          row.refresh_token_cipher,
          Buffer.from(row.refresh_token_iv, 'base64'),
          Buffer.from(row.refresh_token_tag, 'base64')
        )
      } catch (e) {
        console.error('Failed to decrypt refresh token:', e)
        refresh = undefined
      }

      if (!refresh) {
        return NextResponse.json({ error: 'missing_google_tokens', detail: 'no_decryptable_refresh' }, { status: 401 })
      }

      const refreshed = await refreshAccessToken(refresh)
      access = refreshed.access_token
      await persistNewAccessToken(supabase, user.id, access, refreshed.expires_in)
    }

    // 3) Call Admin API; if 401, force one more refresh and retry
    let { ok, status, json } = await callAdminAPI(access!)
    if (!ok && status === 401) {
      // token might have just expired; try to use refresh again
      let refresh: string | undefined
      try {
        refresh = decrypt(
          row.refresh_token_cipher,
          Buffer.from(row.refresh_token_iv, 'base64'),
          Buffer.from(row.refresh_token_tag, 'base64')
        )
      } catch (e) {
        console.error('Failed to decrypt refresh token on retry:', e)
        refresh = undefined
      }

      if (refresh) {
        try {
          const refreshed = await refreshAccessToken(refresh)
          access = refreshed.access_token
          await persistNewAccessToken(supabase, user.id, access, refreshed.expires_in)
          ;({ ok, status, json } = await callAdminAPI(access))
        } catch (e) {
          console.error('Failed to refresh token on retry:', e)
        }
      }
    }

    if (!ok) {
      return NextResponse.json({ error: 'admin_api_failed', detail: json }, { status })
    }

    const items =
      (json?.accountSummaries ?? []).flatMap((acct: any) =>
        (acct?.propertySummaries ?? []).map((p: any) => ({
          propertyId: (p?.property || '').split('/')[1] || '',
          propertyDisplayName: p?.displayName || '',
          accountDisplayName: acct?.displayName || '',
        }))
      )

    // Get the saved property selection from ga4_connections
    const { data: savedConnection } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({ 
      items,
      selectedPropertyId: savedConnection?.property_id || null
    })
  } catch (e: any) {
    console.error('GA4 properties error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
