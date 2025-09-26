export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

async function getAccessToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  const access = decrypt(
    data.access_token_cipher,
    Buffer.from(data.access_token_iv, 'base64'),
    Buffer.from(data.access_token_tag, 'base64')
  )
  return access
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await getAccessToken(supabase, user.id)

    // Test the API call directly
    const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const accJson = await accRes.json()

    return NextResponse.json({
      success: true,
      curlCommand: `curl -H "Authorization: Bearer ${accessToken}" "https://mybusinessaccountmanagement.googleapis.com/v1/accounts"`,
      apiResponse: {
        status: accRes.status,
        ok: accRes.ok,
        data: accJson
      },
      accessToken: accessToken.substring(0, 20) + '...' // Show first 20 chars for verification
    })
  } catch (e: any) {
    console.error('Curl command debug error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

