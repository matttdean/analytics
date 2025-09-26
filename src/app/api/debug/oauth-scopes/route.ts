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

    // Get token info to see granted scopes
    const tokenRes = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const tokenJson = await tokenRes.json()

    // Test GBP accounts API
    const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const accJson = await accRes.json()

    // Test locations for first account if available
    let locationsTest = null
    if (accRes.ok && accJson.accounts && accJson.accounts.length > 0) {
      const firstAccount = accJson.accounts[0]
      const locRes = await fetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${firstAccount.name}/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const locJson = await locRes.json()
      locationsTest = {
        status: locRes.status,
        ok: locRes.ok,
        data: locJson,
        accountName: firstAccount.name
      }
    }

    return NextResponse.json({
      success: true,
      requestedScopes: [
        'https://www.googleapis.com/auth/analytics.readonly',
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/plus.business.manage',
        'https://www.googleapis.com/auth/plus.me'
      ],
      grantedScopes: tokenJson.scope ? tokenJson.scope.split(' ') : [],
      tokenInfo: {
        status: tokenRes.status,
        ok: tokenRes.ok,
        data: tokenJson
      },
      accountsTest: {
        status: accRes.status,
        ok: accRes.ok,
        data: accJson
      },
      locationsTest,
      analysis: {
        hasBusinessManageScope: tokenJson.scope?.includes('https://www.googleapis.com/auth/business.manage'),
        hasPlusBusinessManageScope: tokenJson.scope?.includes('https://www.googleapis.com/auth/plus.business.manage'),
        accountsCount: accJson.accounts?.length || 0,
        totalLocations: accJson.accounts?.reduce((sum: number, acc: any) => sum + (acc.locations?.length || 0), 0) || 0
      }
    })
  } catch (e: any) {
    console.error('OAuth scopes debug error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

