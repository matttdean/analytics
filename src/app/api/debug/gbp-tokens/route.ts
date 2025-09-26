import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { getAuthorizedAccessToken } from '@/lib/google'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    console.log('=== DEBUG GBP TOKENS ===')
    console.log('User ID:', user.id)

    // Check if user has Google tokens in the database
    const { data: tokens, error } = await supabase
      .from('google_oauth_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    console.log('Tokens query error:', error)
    console.log('Tokens found:', !!tokens)
    if (tokens) {
      console.log('Token columns:', Object.keys(tokens))
      console.log('Has access_token_cipher:', !!tokens.access_token_cipher)
      console.log('Has refresh_token_cipher:', !!tokens.refresh_token_cipher)
      console.log('Token expiry:', tokens.expiry)
    }

    // Try to get authorized access token
    let accessTokenResult = null
    try {
      accessTokenResult = await getAuthorizedAccessToken(user.id)
      console.log('getAuthorizedAccessToken succeeded')
    } catch (e: any) {
      console.log('getAuthorizedAccessToken failed:', e.message)
      accessTokenResult = { error: e.message }
    }

    return NextResponse.json({
      userId: user.id,
      hasTokensInDB: !!tokens,
      tokensData: tokens ? {
        hasAccessCipher: !!tokens.access_token_cipher,
        hasRefreshCipher: !!tokens.refresh_token_cipher,
        expiry: tokens.expiry,
        updatedAt: tokens.updated_at
      } : null,
      accessTokenTest: accessTokenResult
    })

  } catch (e: any) {
    console.error('Debug GBP tokens error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}


