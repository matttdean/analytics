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

    // Test with a real location ID from your account
    const testLocation = 'locations/test-location-123' // This will be normalized from the fake location

    console.log('Testing with location:', testLocation)

    // Test Business Information API
    const infoRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${testLocation}?readMask=title,storeCode,websiteUri`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    
    const infoJson = await infoRes.json()
    
    return NextResponse.json({
      success: true,
      location: testLocation,
      businessInfo: {
        status: infoRes.status,
        statusText: infoRes.statusText,
        ok: infoRes.ok,
        data: infoJson
      }
    })

  } catch (error: any) {
    console.error('Test real location error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
