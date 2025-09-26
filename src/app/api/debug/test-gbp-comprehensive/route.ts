export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

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
  const refresh = decrypt(
    data.refresh_token_cipher,
    Buffer.from(data.refresh_token_iv, 'base64'),
    Buffer.from(data.refresh_token_tag, 'base64')
  )
  let accessToken = access
  const expiresAt = data.expiry ? Date.parse(data.expiry) : 0

  if (!accessToken || (expiresAt && Date.now() > expiresAt - 60_000)) {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }).toString()
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const j = await r.json()
    if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
    accessToken = j.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }
  return accessToken
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await getAccessToken(supabase, user.id)
    
    // Get the location from the database
    const { data: conn } = await supabase
      .from('gbp_connections')
      .select('location_name, label')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!conn?.location_name) {
      return NextResponse.json({ error: 'no_gbp_location_configured' }, { status: 400 })
    }

    const locationName = conn.location_name
    const normalizedLocationId = locationName.includes('/') 
      ? locationName.split('/').pop() 
      : locationName

    const results = {
      accessToken: accessToken?.substring(0, 20) + '...',
      locationName,
      normalizedLocationId,
      tests: []
    }

    // Test 1: Business Information API with different readMask options
    const readMaskOptions = [
      'title',
      'title,categories',
      'title,categories,phoneNumbers',
      'title,categories,phoneNumbers,websiteUri',
      'title,categories,phoneNumbers,websiteUri,profile',
      'title,categories,phoneNumbers,websiteUri,profile,storefrontAddress',
      'title,categories,phoneNumbers,websiteUri,profile,storefrontAddress,regularHours'
    ]

    for (const readMask of readMaskOptions) {
      try {
        const response = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/locations/${normalizedLocationId}?readMask=${encodeURIComponent(readMask)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        )
        
        const body = await response.text()
        let data: any
        try {
          data = JSON.parse(body)
        } catch {
          data = body.substring(0, 200)
        }

        results.tests.push({
          test: 'Business Information API',
          readMask,
          status: response.status,
          ok: response.ok,
          isJson: typeof data === 'object',
          hasData: data?.title || 'No title',
          response: data
        })
      } catch (e) {
        results.tests.push({
          test: 'Business Information API',
          readMask,
          error: e?.message
        })
      }
    }

    // Test 2: Performance API with different URL formats
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 7) // Shorter range for testing

    const requestBody = {
      metricRequests: [
        { metric: 'CALL_CLICKS' },
        { metric: 'WEBSITE_CLICKS' },
        { metric: 'DRIVING_DIRECTIONS' }
      ],
      timeRange: {
        startDate: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
        endDate: { year: end.getFullYear(), month: end.getMonth() + 1, day: end.getDate() }
      }
    }

    const performanceUrls = [
      `https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics`,
      `https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics?alt=json`,
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics`,
      `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics?alt=json`
    ]

    for (const url of performanceUrls) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 
            Authorization: `Bearer ${accessToken}`, 
            'content-type': 'application/json' 
          },
          body: JSON.stringify(requestBody)
        })
        
        const body = await response.text()
        let data: any
        try {
          data = JSON.parse(body)
        } catch {
          data = body.substring(0, 200)
        }

        results.tests.push({
          test: 'Performance API',
          url,
          status: response.status,
          ok: response.ok,
          isJson: typeof data === 'object',
          hasData: data?.timeSeries ? `${data.timeSeries.length} time series` : 'No time series',
          response: data
        })
      } catch (e) {
        results.tests.push({
          test: 'Performance API',
          url,
          error: e?.message
        })
      }
    }

    // Test 3: Check if location exists in accounts
    try {
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const accountsData = await accountsResponse.json()
      
      results.tests.push({
        test: 'Accounts API',
        status: accountsResponse.status,
        ok: accountsResponse.ok,
        accountsCount: accountsData?.accounts?.length || 0,
        response: accountsData
      })
    } catch (e) {
      results.tests.push({
        test: 'Accounts API',
        error: e?.message
      })
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (e: any) {
    console.error('GBP comprehensive test error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
