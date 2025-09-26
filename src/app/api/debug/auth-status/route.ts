import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      return NextResponse.json({ 
        authenticated: false, 
        error: 'user_error',
        message: userError.message 
      }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({ 
        authenticated: false, 
        error: 'no_user',
        message: 'No user found in session' 
      }, { status: 401 })
    }

    // Check if user has Google OAuth tokens
    const { data: tokens, error: tokensError } = await supabase
      .from('google_oauth_tokens')
      .select('access_token_cipher, refresh_token_cipher, expiry')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      google_tokens: {
        has_access_token: !!tokens?.access_token_cipher,
        has_refresh_token: !!tokens?.refresh_token_cipher,
        expires_at: tokens?.expiry,
        is_expired: tokens?.expiry ? new Date(tokens.expiry) < new Date() : null
      },
      tokens_error: tokensError?.message || null
    })

  } catch (error: any) {
    console.error('Auth status debug error:', error)
    return NextResponse.json({ 
      authenticated: false,
      error: 'server_error',
      message: error.message 
    }, { status: 500 })
  }
}


