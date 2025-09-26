// src/app/api/google/debug/token/route.ts
export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { data, error } = await supabase
      .from('google_oauth_tokens')
      .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry, scope')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ 
        error: 'database_error', 
        detail: error.message 
      }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ 
        error: 'no_token_row',
        message: 'No Google tokens found for this user'
      }, { status: 404 })
    }

    // Check if we have all required fields
    const missingFields = []
    if (!data.access_token_cipher) missingFields.push('access_token_cipher')
    if (!data.access_token_iv) missingFields.push('access_token_iv')
    if (!data.access_token_tag) missingFields.push('access_token_tag')
    if (!data.refresh_token_cipher) missingFields.push('refresh_token_cipher')
    if (!data.refresh_token_iv) missingFields.push('refresh_token_iv')
    if (!data.refresh_token_tag) missingFields.push('refresh_token_tag')

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'incomplete_token_data',
        missingFields,
        message: 'Token data is incomplete - please reconnect your Google account'
      }, { status: 400 })
    }

    // Debug: Log the raw data types and values
    const debugInfo = {
      access_iv_type: typeof data.access_token_iv,
      access_iv_value: data.access_token_iv,
      access_tag_type: typeof data.access_token_tag,
      access_tag_value: data.access_token_tag,
      access_iv_length: data.access_token_iv?.length,
      access_tag_length: data.access_token_tag?.length,
    }

    // Try to decrypt the access token using text columns
    let accessToken = null
    let decryptError = null
    
    try {
      // Convert base64 strings to buffers
      const iv = Buffer.from(data.access_token_iv, 'base64')
      const tag = Buffer.from(data.access_token_tag, 'base64')
      
      // Additional debug info
      debugInfo.iv_buffer_length = iv.length
      debugInfo.tag_buffer_length = tag.length
      debugInfo.iv_buffer_hex = iv.toString('hex')
      debugInfo.tag_buffer_hex = tag.toString('hex')
      
      accessToken = decrypt(
        data.access_token_cipher,
        iv,
        tag
      )
    } catch (e) {
      decryptError = e instanceof Error ? e.message : 'Unknown decryption error'
    }

    if (!accessToken) {
      return NextResponse.json({
        error: 'decryption_failed',
        detail: decryptError,
        debugInfo,
        message: 'Failed to decrypt access token - please reconnect your Google account'
      }, { status: 400 })
    }

    // Test the token with Google
    const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`)
    const tokenInfo = await tokenInfoRes.json().catch(() => ({}))

    const isExpired = new Date(data.expiry).getTime() < Date.now()

    return NextResponse.json({
      success: true,
      tokenValid: tokenInfoRes.ok,
      tokenExpired: isExpired,
      localExpiry: data.expiry,
      scopes: data.scope,
      tokenPreview: accessToken.slice(0, 12) + '…',
      tokenInfo: tokenInfoRes.ok ? {
        scope: tokenInfo.scope,
        expires_in: tokenInfo.expires_in,
        aud: tokenInfo.aud
      } : null,
      googleError: !tokenInfoRes.ok ? tokenInfo : null,
      debugInfo
    })

  } catch (error) {
    console.error('Debug token error:', error)
    return NextResponse.json({
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
