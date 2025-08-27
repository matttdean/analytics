// src/app/api/google/debug/token/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

function normB64(v?: string | null) {
  if (!v || v === '-' || v === 'null') return undefined
  if (v.startsWith('\\x') || v.startsWith('\\\\x')) {
    const hex = v.replace(/^\\+x/i, '')
    return Buffer.from(hex, 'hex').toString('base64')
  }
  return v
}

export async function GET() {
  const supabase = await createWritableClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_iv, access_tag, expiry')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ error: 'no_token_row' }, { status: 404 })

  let access = data.access_token_cipher
  try {
    const mod: any = await import('@/lib/crypto')
    const iv = normB64(data.access_iv)
    const tag = normB64(data.access_tag)
    if (iv && tag) access = mod.decrypt({ cipher: data.access_token_cipher, iv, tag })
  } catch { /* fall back to cipher */ }

  const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(access)}`)
  const j = await r.json().catch(() => ({}))
  return NextResponse.json({
    ok: r.ok,
    status: r.status,
    tokeninfo: j,               // scope, expires_in, aud
    localExpiry: data.expiry,
    tokenPreview: (access || '').slice(0, 12) + '…',
  })
}
