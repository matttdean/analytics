export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

type Decrypt = (val: any) => string
type Encrypt = (s: string) => { cipher: string; iv: string | Buffer; tag: string | Buffer }

function normB64(v?: string | null) {
  if (!v || v === '-' || v === 'null') return undefined
  if (v.startsWith('\\x') || v.startsWith('\\\\x')) {
    const hex = v.replace(/^\\+x/i, '')
    return Buffer.from(hex, 'hex').toString('base64')
  }
  return v
}

async function loadCrypto(): Promise<{ decrypt?: Decrypt; encrypt?: Encrypt }> {
  try {
    const mod: any = await import('@/lib/crypto')
    return { decrypt: mod.decrypt as Decrypt, encrypt: mod.encrypt as Encrypt }
  } catch { return {} }
}

function tryDecryptTriplet(
  cipher?: string | null,
  iv?: string | null,
  tag?: string | null,
  decrypt?: Decrypt
): string | undefined {
  const ivB64 = normB64(iv)
  const tagB64 = normB64(tag)
  if (!cipher || !ivB64 || !tagB64 || !decrypt) return undefined
  try { return decrypt({ cipher, iv: ivB64, tag: tagB64 }) } catch { return undefined }
}

function looksLikeGoogleAccess(t?: string) {
  if (!t) return false
  if (t.startsWith('ya29.')) return true
  return t.length > 20 && !/\s/.test(t)
}

async function readRow(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select(`
      access_token_cipher, access_iv, access_tag,
      refresh_token_cipher, refresh_iv, refresh_tag,
      access_token_enc, refresh_token_enc,
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
  const { encrypt } = await loadCrypto()
  const nowISO = new Date().toISOString()
  const expISO = new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString()

  if (encrypt) {
    const out = encrypt(accessToken)
    const ivB64 = Buffer.isBuffer(out.iv) ? out.iv.toString('base64') : String(out.iv)
    const tagB64 = Buffer.isBuffer(out.tag) ? out.tag.toString('base64') : String(out.tag)
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: out.cipher,
      access_iv: ivB64,
      access_tag: tagB64,
      access_token_iv: ivB64,    // mirror text columns
      access_token_tag: tagB64,
      expires_at: expISO,
      expiry: expISO,
      updated_at: nowISO,
    } as any).eq('user_id', userId)
  } else {
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: accessToken, // plaintext fallback
      expires_at: expISO,
      expiry: expISO,
      updated_at: nowISO,
    } as any).eq('user_id', userId)
  }
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
    const { decrypt } = await loadCrypto()

    // 1) Try to decrypt ACCESS
    let access =
      tryDecryptTriplet(row.access_token_cipher, row.access_iv, row.access_tag, decrypt) ??
      (row.access_token_enc ? (() => { try {
          const o = JSON.parse(row.access_token_enc); return decrypt ? decrypt(o) : (o?.cipher as string|undefined)
        } catch { return undefined } })() : undefined) ??
      // only treat cipher as plaintext if there is NO iv/tag (legacy plaintext write)
      ((!row.access_iv && !row.access_tag) ? (row.access_token_cipher as string | undefined) : undefined)

    // 2) If access unusable, try to decrypt REFRESH and mint a new access
    if (!looksLikeGoogleAccess(access)) {
      const refresh =
        tryDecryptTriplet(row.refresh_token_cipher, row.refresh_iv, row.refresh_tag, decrypt) ??
        (row.refresh_token_enc ? (() => { try {
            const o = JSON.parse(row.refresh_token_enc); return decrypt ? decrypt(o) : (o?.cipher as string|undefined)
          } catch { return undefined } })() : undefined) ??
        ((!row.refresh_iv && !row.refresh_tag) ? (row.refresh_token_cipher as string | undefined) : undefined)

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
      const refresh =
        tryDecryptTriplet(row.refresh_token_cipher, row.refresh_iv, row.refresh_tag, decrypt) ??
        (row.refresh_token_enc ? (() => { try {
            const o = JSON.parse(row.refresh_token_enc); return decrypt ? decrypt(o) : (o?.cipher as string|undefined)
          } catch { return undefined } })() : undefined) ??
        ((!row.refresh_iv && !row.refresh_tag) ? (row.refresh_token_cipher as string | undefined) : undefined)

      if (refresh) {
        try {
          const refreshed = await refreshAccessToken(refresh)
          access = refreshed.access_token
          await persistNewAccessToken(supabase, user.id, access, refreshed.expires_in)
          ;({ ok, status, json } = await callAdminAPI(access))
        } catch {/* ignore */}
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

    return NextResponse.json({ items })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
