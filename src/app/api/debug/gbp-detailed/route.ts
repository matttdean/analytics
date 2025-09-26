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

    // List GBP accounts with detailed logging
    console.log('🔍 Fetching GBP accounts...')
    const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    const accJson = await accRes.json()
    console.log('📊 Accounts response:', JSON.stringify(accJson, null, 2))
    
    if (!accRes.ok) {
      return NextResponse.json({ 
        error: 'accounts_failed', 
        detail: accJson,
        status: accRes.status 
      }, { status: accRes.status })
    }

    const accounts = []
    for (const a of accJson.accounts ?? []) {
      console.log(`🔍 Fetching locations for account: ${a.name}`)
      
      // List locations for each account
      const locRes = await fetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${a.name}/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const locJson = await locRes.json()
      console.log(`📊 Locations response for ${a.name}:`, JSON.stringify(locJson, null, 2))
      
      const locations = (locJson.locations ?? []).map((l: any) => ({
        name: l.name,                                   // "accounts/{acct}/locations/{loc}"
        title: l.displayName,
        address: [
          l.storefrontAddress?.addressLines?.join(' '),
          l.storefrontAddress?.locality,
          l.storefrontAddress?.administrativeArea,
          l.storefrontAddress?.postalCode,
        ].filter(Boolean).join(', '),
        phone: l.primaryPhone || '',
        website: l.websiteUrl || '',
        category: l.primaryCategory?.displayName || ''
      }))

      accounts.push({
        name: a.name,
        accountName: a.accountName || a.organizationInfo?.registeredDomain || a.name,
        type: a.type,
        verificationState: a.verificationState,
        vettedState: a.vettedState,
        locations
      })
    }

    return NextResponse.json({ 
      success: true,
      accounts,
      debug: {
        totalAccounts: accounts.length,
        totalLocations: accounts.reduce((sum, acc) => sum + acc.locations.length, 0),
        accountDetails: accounts.map(acc => ({
          name: acc.name,
          accountName: acc.accountName,
          type: acc.type,
          locationCount: acc.locations.length
        }))
      }
    })
  } catch (e: any) {
    console.error('GBP detailed debug error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

