export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

async function getTokens(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  let access: string | undefined
  try {
    access = decrypt(
      data.access_token_cipher,
      Buffer.from(data.access_token_iv, 'base64'),
      Buffer.from(data.access_token_tag, 'base64')
    )
  } catch {}

  let refresh: string | undefined
  try {
    refresh = decrypt(
      data.refresh_token_cipher,
      Buffer.from(data.refresh_token_iv, 'base64'),
      Buffer.from(data.refresh_token_tag, 'base64')
    )
  } catch {}

  const expiresAt = data.expiry ? Date.parse(data.expiry) : 0
  return { access, refresh, expiresAt }
}

async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString()

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  const j = await r.json()
  if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
  return j as { access_token: string; expires_in: number }
}

async function ensureAccessToken(supabase: any, userId: string) {
  const { access, refresh, expiresAt } = await getTokens(supabase, userId)
  let accessToken = access

  if (!accessToken) {
    if (!refresh) throw new Error('no_access_token')
    const ref = await refreshAccessToken(refresh)
    accessToken = ref.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (ref.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  } else if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
    const ref = await refreshAccessToken(refresh)
    accessToken = ref.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (ref.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }

  if (!accessToken) throw new Error('no_access_token')
  return accessToken
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await ensureAccessToken(supabase, user.id)
    const locationId = 'locations/2765560021277676673'

    // Test all possible API endpoints and readMask combinations
    const results: any = {
      tokenInfo: {
        hasToken: !!accessToken,
        tokenPreview: accessToken?.substring(0, 20) + '...'
      }
    }

    // 1. Test Business Information API with different readMask options
    const readMaskOptions = [
      'title',
      'primaryCategory',
      'storefrontAddress',
      'phoneNumbers',
      'websiteUri',
      'regularHours',
      'profile',
      'title,primaryCategory',
      'title,primaryCategory,storefrontAddress',
      'title,primaryCategory,storefrontAddress,phoneNumbers',
      'title,primaryCategory,storefrontAddress,phoneNumbers,websiteUri',
      'title,primaryCategory,storefrontAddress,phoneNumbers,websiteUri,regularHours',
      'title,primaryCategory,storefrontAddress,phoneNumbers,websiteUri,regularHours,profile'
    ]

    results.businessInfoTests = []
    for (const readMask of readMaskOptions) {
      try {
        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationId}?readMask=${readMask}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
        const data = await res.json()
        
        results.businessInfoTests.push({
          readMask,
          status: res.status,
          ok: res.ok,
          hasData: !!data.title || !!data.primaryCategory || !!data.storefrontAddress,
          response: data
        })
      } catch (e) {
        results.businessInfoTests.push({
          readMask,
          error: e?.message || 'Unknown error'
        })
      }
    }

    // 2. Test Performance API
    try {
      const perfUrl = `https://businessprofileperformance.googleapis.com/v1/${locationId}:fetchMetrics`
      const perfRes = await fetch(perfUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          metricRequests: [
            { metric: 'CALL_CLICKS' },
            { metric: 'WEBSITE_CLICKS' },
            { metric: 'DRIVING_DIRECTIONS' },
          ],
          timeRange: { 
            startTime: '2025-08-01T00:00:00Z', 
            endTime: '2025-09-05T23:59:59Z' 
          },
        }),
      })
      
      const perfData = await perfRes.json()
      results.performanceApi = {
        status: perfRes.status,
        ok: perfRes.ok,
        response: perfData
      }
    } catch (e) {
      results.performanceApi = {
        error: e?.message || 'Unknown error'
      }
    }

    // 3. Test Account Management API
    try {
      const accRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const accData = await accRes.json()
      results.accountsApi = {
        status: accRes.status,
        ok: accRes.ok,
        response: accData
      }
    } catch (e) {
      results.accountsApi = {
        error: e?.message || 'Unknown error'
      }
    }

    // 4. Test Locations API with different readMask options
    try {
      const accountName = 'accounts/102070975441152489673'
      const locRes = await fetch(`https://mybusinessaccountmanagement.googleapis.com/v1/${accountName}/locations`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const locData = await locRes.json()
      results.locationsApi = {
        status: locRes.status,
        ok: locRes.ok,
        response: locData
      }
    } catch (e) {
      results.locationsApi = {
        error: e?.message || 'Unknown error'
      }
    }

    // 5. Test with different location ID formats
    const locationFormats = [
      'locations/2765560021277676673',
      'accounts/102070975441152489673/locations/2765560021277676673'
    ]

    results.locationFormatTests = []
    for (const format of locationFormats) {
      try {
        const res = await fetch(`https://mybusinessbusinessinformation.googleapis.com/v1/${format}`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const data = await res.json()
        
        results.locationFormatTests.push({
          format,
          status: res.status,
          ok: res.ok,
          hasData: !!data.title || !!data.primaryCategory,
          response: data
        })
      } catch (e) {
        results.locationFormatTests.push({
          format,
          error: e?.message || 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      locationId,
      results
    })

  } catch (e: any) {
    console.error('Fetch all GBP data error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}

