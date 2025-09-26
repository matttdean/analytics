// src/app/api/google/debug/refresh/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('google_oauth_tokens')
      .select('refresh_token_cipher, refresh_token_iv, refresh_token_tag, access_token_cipher, access_token_iv, access_token_tag, expiry')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ 
        error: 'database_error', 
        detail: error.message 
      }, { status: 500 })
    }

    if (!data?.refresh_token_cipher) {
      return NextResponse.json({ 
        error: 'no_refresh_token',
        message: 'No refresh token found - please reconnect your Google account'
      }, { status: 400 })
    }

    // Decrypt refresh token
    let refreshToken = null
    try {
      refreshToken = decrypt(
        data.refresh_token_cipher,
        Buffer.from(data.refresh_token_iv, 'base64'),
        Buffer.from(data.refresh_token_tag, 'base64')
      )
    } catch (e) {
      return NextResponse.json({
        error: 'decryption_failed',
        detail: e instanceof Error ? e.message : 'Unknown decryption error',
        message: 'Failed to decrypt refresh token - please reconnect your Google account'
      }, { status: 400 })
    }

    // Exchange refresh token for new access token
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString()

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    
    const tokenData = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json({ 
        error: 'refresh_failed',
        status: res.status,
        detail: tokenData,
        message: 'Failed to refresh token with Google'
      }, { status: res.status })
    }

    // Encrypt and store new access token
    try {
      const encA = encrypt(tokenData.access_token)
      const newExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()
      
      const { error: updateError } = await supabase
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
        .eq('user_id', user.id)

      if (updateError) {
        return NextResponse.json({
          error: 'update_failed',
          detail: updateError.message,
          message: 'Failed to update token in database'
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true,
        refreshed: true,
        token_type: tokenData.token_type,
        expires_in: tokenData.expires_in,
        new_expiry: newExpiry
      })

    } catch (encryptError) {
      return NextResponse.json({
        error: 'encryption_failed',
        detail: encryptError instanceof Error ? encryptError.message : 'Unknown encryption error',
        message: 'Failed to encrypt new access token'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Refresh token error:', error)
    return NextResponse.json({
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
