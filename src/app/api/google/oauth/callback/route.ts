export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

type EncryptOut = { cipher: string; iv: string | Buffer; tag: string | Buffer }

function toBase64(s: string | Buffer) {
  return Buffer.isBuffer(s) ? s.toString('base64') : String(s)
}

async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI ?? '',
    grant_type: 'authorization_code',
  }).toString()

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json()
  if (!r.ok) {
    const msg = typeof j?.error === 'string'
      ? `${j.error}: ${j.error_description ?? 'unknown'}`
      : JSON.stringify(j)
    throw new Error(`Google token exchange failed (${r.status}): ${msg}`)
  }
  return j as {
    access_token: string
    refresh_token?: string
    token_type: string
    expires_in: number
    scope?: string
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const origin = url.origin

  try {
    // Any OAuth error from Google?
    const oauthErr = url.searchParams.get('error')
    if (oauthErr) {
      return NextResponse.redirect(`${origin}/dashboard?google_error=${encodeURIComponent(oauthErr)}`)
    }

    const code = url.searchParams.get('code')
    if (!code) {
      return NextResponse.redirect(`${origin}/dashboard?google_error=missing_code`)
    }

    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(`${origin}/login?error=unauthenticated`)

    // 1) Exchange code at Google
    const t = await exchangeCodeForTokens(code)
    const access = t.access_token
    let refresh = t.refresh_token || null // may be null if user already granted access
    const scopes = (t.scope || url.searchParams.get('scope') || '').split(/\s+/).filter(Boolean)
    const expiryISO = new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString()
    const now = new Date().toISOString()

    // 2) If Google didn't send a refresh_token, try to reuse existing one
    if (!refresh) {
      const { data: existing } = await supabase
        .from('google_oauth_tokens')
        .select('refresh_token_cipher, refresh_iv, refresh_tag')
        .eq('user_id', user.id)
        .maybeSingle()
      if (existing?.refresh_token_cipher && existing?.refresh_iv && existing?.refresh_tag) {
        // Reuse existing refresh token pieces as-is
        const { error } = await supabase
          .from('google_oauth_tokens')
          .upsert(
            {
              user_id: user.id,
              provider: 'google',
              // access pieces will be set below
            } as any,
            { onConflict: 'user_id' }
          )
        // We won't error here; we'll overwrite fully below
      } else {
        // No refresh available anywhere — instruct user to re-consent with offline access
        return NextResponse.redirect(
          `${origin}/dashboard?google_error=${encodeURIComponent(
            'missing_refresh_token: please reconnect (prompt=consent & access_type=offline)'
          )}`
        )
      }
    }

    // 3) Encrypt (AES-256-GCM using your lib/crypto.ts)
    let encrypt: ((s: string) => EncryptOut)
    try {
      const mod: any = await import('@/lib/crypto')
      encrypt = mod.encrypt as (s: string) => EncryptOut
    } catch {
      return NextResponse.redirect(
        `${origin}/dashboard?google_error=${encodeURIComponent('encryption_module_missing')}`
      )
    }

    // Access token pieces
    const a = encrypt(access)
    const access_cipher = a.cipher
    const access_iv_b64 = toBase64(a.iv)
    const access_tag_b64 = toBase64(a.tag)

    // Refresh token pieces (either from Google or reuse existing from DB)
    let refresh_cipher = ''
    let refresh_iv_b64 = ''
    let refresh_tag_b64 = ''

    if (refresh) {
      const r = encrypt(refresh)
      refresh_cipher = r.cipher
      refresh_iv_b64 = toBase64(r.iv)
      refresh_tag_b64 = toBase64(r.tag)
    } else {
      // fetch existing pieces to satisfy NOT NULL constraints
      const { data: existingRT } = await supabase
        .from('google_oauth_tokens')
        .select('refresh_token_cipher, refresh_iv, refresh_tag')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!existingRT?.refresh_token_cipher || !existingRT?.refresh_iv || !existingRT?.refresh_tag) {
        return NextResponse.redirect(
          `${origin}/dashboard?google_error=${encodeURIComponent(
            'missing_refresh_token: please reconnect (prompt=consent & access_type=offline)'
          )}`
        )
      }
      refresh_cipher = existingRT.refresh_token_cipher
      // existing bytea will come back as base64 from PostgREST; just reuse
      refresh_iv_b64 = existingRT.refresh_iv
      refresh_tag_b64 = existingRT.refresh_tag
    }

    // 4) Upsert to your exact columns - store as text to avoid bytea conversion issues
    const { error } = await supabase
      .from('google_oauth_tokens')
      .upsert(
        {
          user_id: user.id,
          provider: 'google',

          // cipher columns (text, NOT NULL)
          access_token_cipher: access_cipher,
          refresh_token_cipher: refresh_cipher,

          // Store IV/TAG as text columns to avoid bytea conversion issues
          access_token_iv: access_iv_b64,
          access_token_tag: access_tag_b64,
          refresh_token_iv: refresh_iv_b64,
          refresh_token_tag: refresh_tag_b64,

          // Also store in bytea columns for compatibility
          access_iv: access_iv_b64,
          access_tag: access_tag_b64,
          refresh_iv: refresh_iv_b64,
          refresh_tag: refresh_tag_b64,

          // Scopes & expiry
          scope: scopes,
          token_type: t.token_type,
          expires_at: expiryISO,
          expiry: expiryISO,       // <-- your NOT NULL column
          updated_at: now,
          created_at: now,
        } as any,
        { onConflict: 'user_id' }
      )

    if (error) {
      return NextResponse.redirect(
        `${origin}/dashboard?google_error=token_store_failed:${encodeURIComponent(error.message)}`
      )
    }

    return NextResponse.redirect(`${origin}/dashboard?google_connected=1`)
  } catch (e: any) {
    const msg = e?.message ?? 'unknown_error'
    return NextResponse.redirect(`${origin}/dashboard?google_error=${encodeURIComponent(msg)}`)
  }
}
