import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

async function readToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error('missing_google_tokens')

  try {
    const access = decrypt(
      data.access_token_cipher,
      Buffer.from(data.access_token_iv, 'base64'),
      Buffer.from(data.access_token_tag, 'base64')
    )
    const refresh = decrypt(
      data.refresh_token_cipher,
      Buffer.from(data.refresh_token_iv, 'base64'),
      Buffer.from(data.refresh_token_tag, 'base64')
    )
    const expiresAt = data.expiry ? Date.parse(data.expiry) : 0

    return { access, refresh, expiresAt }
  } catch (decryptError) {
    console.error('Token decryption failed:', decryptError)
    throw new Error('token_decryption_failed')
  }
}

export async function GET(req: Request) {
  try {
    console.log('=== GBP TEST API START ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Get Google tokens
    const { access } = await readToken(supabase, user.id)
    const accessToken = access as string

    console.log('Access token obtained, testing GBP API access...')

    // Test 1: Basic userinfo to verify token works
    console.log('Test 1: Userinfo endpoint')
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    })
    
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json()
      console.log('Userinfo successful:', userInfo.email)
    } else {
      console.error('Userinfo failed:', userInfoResponse.status)
    }

    // Test 2: GBP accounts endpoint
    console.log('Test 2: GBP accounts endpoint')
    const accountResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      }
    )
    
    console.log('GBP accounts response status:', accountResponse.status)
    
    if (accountResponse.ok) {
      const accountData = await accountResponse.json()
      console.log('GBP accounts successful:', accountData)
      return NextResponse.json({
        success: true,
        message: 'GBP API access confirmed',
        accounts: accountData,
        userInfo: userInfoResponse.ok ? 'Token valid' : 'Token invalid'
      })
    } else {
      const errorText = await accountResponse.text()
      console.error('GBP accounts failed:', errorText)
      
      return NextResponse.json({
        success: false,
        message: 'GBP API access failed',
        status: accountResponse.status,
        error: errorText,
        userInfo: userInfoResponse.ok ? 'Token valid' : 'Token invalid'
      })
    }
    
  } catch (e: any) {
    console.error('GBP test error:', e)
    return NextResponse.json({ 
      success: false,
      error: e?.message || 'unknown_error',
      details: e.toString()
    }, { status: 500 })
  }
}
