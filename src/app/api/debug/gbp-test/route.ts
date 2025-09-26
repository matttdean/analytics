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

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    let accessToken = access as string
    
    // Check token info
    const tokenInfoResponse = await fetch(
      `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`
    )
    
    let tokenInfo = null
    if (tokenInfoResponse.ok) {
      tokenInfo = await tokenInfoResponse.json()
    }

    // Test basic GBP API connection
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
    
    try {
      const testResponse = await fetch(
        'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          },
          signal: controller.signal
        }
      )
      
      clearTimeout(timeoutId)
      
      const testData = testResponse.ok ? await testResponse.json() : null
      
      return NextResponse.json({
        success: true,
        tokenInfo: {
          scopes: tokenInfo?.scope,
          expiresIn: tokenInfo?.expires_in,
          audience: tokenInfo?.audience
        },
        gbpTest: {
          status: testResponse.status,
          statusText: testResponse.statusText,
          ok: testResponse.ok,
          data: testData
        },
        debug: {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refresh,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          isExpired: expiresAt ? Date.now() > expiresAt : false
        }
      })
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      return NextResponse.json({
        success: false,
        tokenInfo: {
          scopes: tokenInfo?.scope,
          expiresIn: tokenInfo?.expires_in,
          audience: tokenInfo?.audience
        },
        gbpTest: {
          error: fetchError.name === 'AbortError' ? 'timeout' : fetchError.message,
          timeout: fetchError.name === 'AbortError'
        },
        debug: {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refresh,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
          isExpired: expiresAt ? Date.now() > expiresAt : false
        }
      })
    }

  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || 'unknown_error' 
    }, { status: 500 })
  }
}


