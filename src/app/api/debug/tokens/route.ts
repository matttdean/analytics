import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Check if user has Google tokens
    const { data: tokens, error } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!tokens) {
      return NextResponse.json({ 
        error: 'no_tokens',
        message: 'No Google tokens found for user'
      }, { status: 404 })
    }

    return NextResponse.json({
      hasTokens: true,
      hasAccessToken: !!tokens.access_token_cipher,
      hasRefreshToken: !!tokens.refresh_token_cipher,
      expiry: tokens.expiry,
      updatedAt: tokens.updated_at
    })

  } catch (e: any) {
    console.error('Debug tokens error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}


