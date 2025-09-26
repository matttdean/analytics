export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

async function getTokens(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  let access: string | undefined
  try {
    access = decrypt(
      data.access_token_cipher,
      Buffer.from(data.access_token_iv, 'base64'),
      Buffer.from(data.access_token_tag, 'base64')
    )
  } catch {}

  let refresh: string | undefined
  try {
    refresh = decrypt(
      data.refresh_token_cipher,
      Buffer.from(data.refresh_token_iv, 'base64'),
      Buffer.from(data.refresh_token_tag, 'base64')
    )
  } catch {}

  const expiresAt = data.expiry ? Date.parse(data.expiry) : 0
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
  if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
  return j as { access_token: string; expires_in: number }
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Get current token info
    const { access, refresh, expiresAt } = await getTokens(supabase, user.id)
    
    const results = {
      beforeRefresh: {
        hasAccessToken: !!access,
        hasRefreshToken: !!refresh,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        isExpired: expiresAt ? Date.now() > expiresAt : true,
        accessTokenPreview: access ? access.substring(0, 20) + '...' : null
      },
      refreshResult: null,
      afterRefresh: null,
      testResult: null
    }

    // Force refresh the token
    if (refresh) {
      try {
        const ref = await refreshAccessToken(refresh)
        results.refreshResult = {
          success: true,
          expiresIn: ref.expires_in,
          newTokenPreview: ref.access_token.substring(0, 20) + '...'
        }

        // Save the new token
        const enc = encrypt(ref.access_token)
        const expISO = new Date(Date.now() + (ref.expires_in || 3600) * 1000).toISOString()
        await supabase.from('google_oauth_tokens').update({
          access_token_cipher: enc.cipher,
          access_token_iv: enc.iv.toString('base64'),
          access_token_tag: enc.tag.toString('base64'),
          expiry: expISO,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id)

        // Test the new token
        const testRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
          headers: { Authorization: `Bearer ${ref.access_token}` }
        })
        const testJson = await testRes.json()
        
        results.afterRefresh = {
          hasNewToken: true,
          newExpiresAt: expISO
        }
        
        results.testResult = {
          status: testRes.status,
          ok: testRes.ok,
          data: testJson
        }

      } catch (e: any) {
        results.refreshResult = {
          success: false,
          error: e.message
        }
      }
    } else {
      results.refreshResult = {
        success: false,
        error: 'No refresh token available'
      }
    }

    return NextResponse.json({
      success: true,
      results
    })
  } catch (e: any) {
    console.error('Token refresh debug error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

