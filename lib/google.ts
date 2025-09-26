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

export async function getAuthorizedAccessToken(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('id, access_token_cipher, refresh_token_cipher, access_token_iv, access_token_tag, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error('No Google tokens on file')

  try {
    const accessTokenPlain = decrypt(
      data.access_token_cipher,
      Buffer.from(data.access_token_iv, 'base64'),
      Buffer.from(data.access_token_tag, 'base64')
    )
    const refreshTokenPlain = decrypt(
      data.refresh_token_cipher,
      Buffer.from(data.refresh_token_iv, 'base64'),
      Buffer.from(data.refresh_token_tag, 'base64')
    )

    const isExpired = new Date(data.expiry).getTime() < Date.now() + 60_000
    if (!isExpired) return accessTokenPlain

    // Token is expired, refresh it
    const refreshed = await refreshAccessToken(refreshTokenPlain)
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
    const encA = encrypt(refreshed.access_token)

    const { error: upErr } = await supabase
      .from('google_oauth_tokens')
      .update({
        access_token_cipher: encA.cipher,
        access_token_iv: encA.iv.toString('base64'),
        access_token_tag: encA.tag.toString('base64'),
        access_iv: encA.iv.toString('base64'),
        access_tag: encA.tag.toString('base64'),
        expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('id', data.id)

    if (upErr) throw upErr
    return refreshed.access_token
  } catch (decryptError) {
    console.error('Token decryption failed:', decryptError)
    throw new Error('Token decryption failed - please reconnect your Google account')
  }
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
      access_token_iv: encA.iv.toString('base64'),
      access_token_tag: encA.tag.toString('base64'),
      access_iv: encA.iv.toString('base64'),
      access_tag: encA.tag.toString('base64'),
      refresh_token_cipher: encR.cipher,
      refresh_token_iv: encR.iv.toString('base64'),
      refresh_token_tag: encR.tag.toString('base64'),
      refresh_iv: encR.iv.toString('base64'),
      refresh_tag: encR.tag.toString('base64'),
      scope: scope.split(' '),
      expiry,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) throw error
}
