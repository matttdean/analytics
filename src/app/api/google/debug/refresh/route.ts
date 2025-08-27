// src/app/api/google/debug/refresh/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createWritableClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data } = await supabase
    .from('google_oauth_tokens')
    .select('refresh_token_cipher, refresh_iv, refresh_tag')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data?.refresh_token_cipher) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 400 })
  }

  // decrypt refresh
  let refresh = data.refresh_token_cipher
  try {
    const mod: any = await import('@/lib/crypto')
    if (data.refresh_iv && data.refresh_tag) {
      const iv = Buffer.isBuffer(data.refresh_iv) ? data.refresh_iv.toString('base64') : String(data.refresh_iv)
      const tag = Buffer.isBuffer(data.refresh_tag) ? data.refresh_tag.toString('base64') : String(data.refresh_tag)
      refresh = mod.decrypt({ cipher: data.refresh_token_cipher, iv, tag })
    }
  } catch {}

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
  const j = await r.json().catch(() => ({}))

  if (!r.ok) return NextResponse.json({ ok: false, step: 'refresh', detail: j }, { status: r.status })

  // persist new access token (encrypt)
  try {
    const mod: any = await import('@/lib/crypto')
    const out = mod.encrypt(j.access_token)
    const ivB64 = Buffer.isBuffer(out.iv) ? out.iv.toString('base64') : String(out.iv)
    const tagB64 = Buffer.isBuffer(out.tag) ? out.tag.toString('base64') : String(out.tag)
    const expiry = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: out.cipher,
      access_iv: ivB64,
      access_tag: tagB64,
      access_token_iv: ivB64,
      access_token_tag: tagB64,
      expiry, expires_at: expiry,
      updated_at: new Date().toISOString(),
    } as any).eq('user_id', user.id)
  } catch {}

  return NextResponse.json({ ok: true, refreshed: true, token_type: j.token_type, expires_in: j.expires_in })
}
