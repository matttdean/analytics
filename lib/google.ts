import { createClient } from '@/lib/supabase/server'
import { encrypt, decrypt } from '@/lib/crypto'

const GOOGLE_AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

const BASE_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/business.manage',
]

export function buildAuthUrl() {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: BASE_SCOPES.join(' '),
  })
  return `${GOOGLE_AUTH_BASE}?${p.toString()}`
}

export async function exchangeCodeForTokens(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    grant_type: 'authorization_code',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error('Token exchange failed')
  return res.json() as Promise<{
    access_token: string
    expires_in: number
    refresh_token: string
    scope: string
    token_type: string
  }>
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error('Refresh failed')
  return res.json() as Promise<{ access_token: string; expires_in: number; scope?: string }>
}

/** Convert Supabase bytea returns (\"\\x...\" hex, base64, Buffer, or Uint8Array) to Buffer */
function toBuf(v: unknown): Buffer {
  if (v instanceof Uint8Array) return Buffer.from(v)
  if (typeof v === 'string') {
    if (v.startsWith('\\x') || v.startsWith('0x')) return Buffer.from(v.replace(/^\\x|^0x/, ''), 'hex')
    // fallback assume base64
    return Buffer.from(v, 'base64')
  }
  // Edge: { type: 'Buffer', data: number[] }
  if (typeof v === 'object' && v && (v as any).type === 'Buffer' && Array.isArray((v as any).data)) {
    return Buffer.from((v as any).data)
  }
  throw new Error('Unsupported bytea format from Supabase')
}

/** hex string for bytea insert via PostgREST */
const hex = (b: Buffer) => '\\x' + b.toString('hex')

export async function getAuthorizedAccessToken(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('id, access_token_cipher, refresh_token_cipher, access_iv, access_tag, refresh_iv, refresh_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error('No Google tokens on file')

  const accessTokenPlain = decrypt(
    data.access_token_cipher,
    toBuf(data.access_iv as any),
    toBuf(data.access_tag as any)
  )
  const refreshTokenPlain = decrypt(
    data.refresh_token_cipher,
    toBuf(data.refresh_iv as any),
    toBuf(data.refresh_tag as any)
  )

  const isExpired = new Date(data.expiry).getTime() < Date.now() + 60_000
  if (!isExpired) return accessTokenPlain

  const refreshed = await refreshAccessToken(refreshTokenPlain)
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const encA = encrypt(refreshed.access_token)

  const { error: upErr } = await supabase
    .from('google_oauth_tokens')
    .update({
      access_token_cipher: encA.cipher,
      access_iv: hex(encA.iv),
      access_tag: hex(encA.tag),
      expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)

  if (upErr) throw upErr
  return refreshed.access_token
}

export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  scope: string,
  expiresInSec: number
) {
  const supabase = await createClient()
  const encA = encrypt(accessToken)
  const encR = encrypt(refreshToken)
  const expiry = new Date(Date.now() + expiresInSec * 1000).toISOString()

  const { error } = await supabase.from('google_oauth_tokens').upsert(
    {
      user_id: userId,
      access_token_cipher: encA.cipher,
      access_iv: hex(encA.iv),
      access_tag: hex(encA.tag),
      refresh_token_cipher: encR.cipher,
      refresh_iv: hex(encR.iv),
      refresh_tag: hex(encR.tag),
      scope: scope.split(' '),
      expiry,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error
}
