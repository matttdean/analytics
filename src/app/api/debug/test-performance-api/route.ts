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
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 27)

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

    // Test both URL formats
    const normalizedLocationId = locationName.includes('/') 
      ? locationName.split('/').pop() 
      : locationName
    
    const url1 = `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics`
    const url2 = `https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics`
    
    console.log('Testing Performance API with:')
    console.log('URL 1 (full path):', url1)
    console.log('URL 2 (normalized):', url2)
    console.log('Request Body:', JSON.stringify(requestBody, null, 2))

    // Try the normalized format first
    const response = await fetch(url2, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`, 
        'content-type': 'application/json' 
      },
      body: JSON.stringify(requestBody)
    })

    let responseData: any
    let isJson = true
    let responseText = ''

    // Read the response body once
    const responseBody = await response.text()
    
    try {
      responseData = JSON.parse(responseBody)
    } catch (e) {
      isJson = false
      responseText = responseBody
    }

    return NextResponse.json({
      success: true,
      locationName,
      normalizedLocationId,
      accessToken: accessToken?.substring(0, 20) + '...',
      urls: {
        fullPath: url1,
        normalized: url2,
        tested: url2
      },
      request: {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken?.substring(0, 20)}...`,
          'content-type': 'application/json'
        },
        body: requestBody
      },
      response: {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        isJson,
        data: isJson ? responseData : responseText.substring(0, 1000),
        headers: Object.fromEntries(response.headers.entries())
      }
    })

  } catch (e: any) {
    console.error('Performance API debug error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
