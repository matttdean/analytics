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

    const results = {
      tokenInfo: null,
      accountsTest: null,
      locationsTest: null,
      businessInfoTest: null,
      errors: []
    }

    // 1. Test token info
    try {
      const tokenRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const tokenJson = await tokenRes.json()
      results.tokenInfo = {
        status: tokenRes.status,
        ok: tokenRes.ok,
        data: tokenJson
      }
    } catch (e: any) {
      results.errors.push(`Token info error: ${e.message}`)
    }

    // 2. Test accounts API
    try {
      const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const accJson = await accRes.json()
      results.accountsTest = {
        status: accRes.status,
        ok: accRes.ok,
        data: accJson
      }

      // 3. If accounts work, test locations for first account
      if (accRes.ok && accJson.accounts && accJson.accounts.length > 0) {
        const firstAccount = accJson.accounts[0]
        try {
          const locRes = await fetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${firstAccount.name}/locations`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          const locJson = await locRes.json()
          results.locationsTest = {
            status: locRes.status,
            ok: locRes.ok,
            data: locJson,
            accountName: firstAccount.name
          }
        } catch (e: any) {
          results.errors.push(`Locations test error: ${e.message}`)
        }
      }
    } catch (e: any) {
      results.errors.push(`Accounts test error: ${e.message}`)
    }

    // 4. Test Business Information API with a known location format
    try {
      // Try to get business info for a test location
      const testLocation = 'locations/test-location-123'
      const infoRes = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${testLocation}?readMask=title,storeCode,websiteUri`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const infoJson = await infoRes.json()
      results.businessInfoTest = {
        status: infoRes.status,
        ok: infoRes.ok,
        data: infoJson,
        testLocation
      }
    } catch (e: any) {
      results.errors.push(`Business info test error: ${e.message}`)
    }

    return NextResponse.json({
      success: true,
      results,
      recommendations: [
        "1. Check if Google My Business Account Management API is enabled in Google Cloud Console",
        "2. Check if Google My Business Business Information API is enabled in Google Cloud Console", 
        "3. Verify the OAuth scopes include 'https://www.googleapis.com/auth/business.manage'",
        "4. Make sure your Google Business Profile is properly set up and verified",
        "5. Check if you're using the same Google account for both the app and Business Profile"
      ]
    })
  } catch (e: any) {
    console.error('GBP permissions debug error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

