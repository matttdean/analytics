import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ connected: false, error: 'unauthenticated' }, { status: 401 })
    }

    // Check if user has Google OAuth tokens
    const { data: tokens, error } = await supabase
      .from('google_oauth_tokens')
      .select('access_token_cipher, refresh_token_cipher, expiry')
      .eq('user_id', user.id)
      .single()

    if (error || !tokens) {
      return NextResponse.json({ connected: false, error: 'no_tokens' })
    }

    // Check if tokens are still valid (not expired)
    const isExpired = tokens.expiry && new Date(tokens.expiry) < new Date()
    
    return NextResponse.json({ 
      connected: !isExpired,
      hasRefreshToken: !!tokens.refresh_token_cipher,
      expiresAt: tokens.expiry
    })

  } catch (error: any) {
    console.error('OAuth status check error:', error)
    return NextResponse.json({ 
      connected: false, 
      error: error.message 
    }, { status: 500 })
  }
}


