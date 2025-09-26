import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('=== TOKEN TEST ENDPOINT ===')
    
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        error: 'not_authenticated',
        message: 'User not authenticated'
      }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Check raw tokens in database
    const { data: rawTokens, error: rawError } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single()

    console.log('Raw tokens query result:', {
      hasData: !!rawTokens,
      error: rawError?.message,
      hasAccessCipher: !!rawTokens?.access_token_cipher,
      hasRefreshCipher: !!rawTokens?.refresh_token_cipher,
      expiry: rawTokens?.expiry
    })

    if (rawError) {
      return NextResponse.json({
        error: 'database_error',
        message: rawError.message
      }, { status: 500 })
    }

    if (!rawTokens) {
      return NextResponse.json({
        error: 'no_tokens_in_db',
        message: 'No tokens found in database'
      }, { status: 404 })
    }

    // Test token decryption
    try {
      console.log('Testing token decryption...')
      const { readToken } = await import('@/lib/google')
      const { access, refresh, expiresAt } = await readToken(supabase, user.id)
      
      console.log('Token decryption result:', {
        hasAccess: !!access,
        hasRefresh: !!refresh,
        accessLength: access?.length || 0,
        refreshLength: refresh?.length || 0,
        expiresAt: expiresAt,
        isExpired: expiresAt ? new Date(expiresAt) < new Date() : null
      })

      return NextResponse.json({
        success: true,
        tokens: {
          hasAccess: !!access,
          hasRefresh: !!refresh,
          accessLength: access?.length || 0,
          refreshLength: refresh?.length || 0,
          expiresAt: expiresAt,
          isExpired: expiresAt ? new Date(expiresAt) < new Date() : null
        },
        rawTokens: {
          hasAccessCipher: !!rawTokens.access_token_cipher,
          hasRefreshCipher: !!rawTokens.refresh_token_cipher,
          hasAccessIV: !!rawTokens.access_token_iv,
          hasRefreshIV: !!rawTokens.refresh_token_iv,
          hasAccessTag: !!rawTokens.access_token_tag,
          hasRefreshTag: !!rawTokens.refresh_token_tag,
          expiry: rawTokens.expiry
        }
      })

    } catch (decryptError: any) {
      console.error('Token decryption failed:', decryptError)
      return NextResponse.json({
        error: 'decryption_failed',
        message: decryptError.message,
        stack: decryptError.stack
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Token test endpoint error:', error)
    return NextResponse.json({
      error: 'internal_error',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}


