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

    // Generate curl commands for both URL formats
    const curl1 = `curl -i -X POST \\
  "https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics?alt=json" \\
  -H "Authorization: Bearer ${accessToken}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestBody, null, 2)}'`

    const curl2 = `curl -i -X POST \\
  "https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics?alt=json" \\
  -H "Authorization: Bearer ${accessToken}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(requestBody, null, 2)}'`

    // Test both URLs
    const testResults = []
    
    // Test URL 1 (full path)
    try {
      const response1 = await fetch(`https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics?alt=json`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`, 
          'content-type': 'application/json' 
        },
        body: JSON.stringify(requestBody)
      })
      
      const body1 = await response1.text()
      let data1: any
      try {
        data1 = JSON.parse(body1)
      } catch {
        data1 = body1.substring(0, 500)
      }
      
      testResults.push({
        url: `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics?alt=json`,
        status: response1.status,
        ok: response1.ok,
        data: data1
      })
    } catch (e) {
      testResults.push({
        url: `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics?alt=json`,
        error: e?.message
      })
    }

    // Test URL 2 (normalized)
    try {
      const response2 = await fetch(`https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics?alt=json`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${accessToken}`, 
          'content-type': 'application/json' 
        },
        body: JSON.stringify(requestBody)
      })
      
      const body2 = await response2.text()
      let data2: any
      try {
        data2 = JSON.parse(body2)
      } catch {
        data2 = body2.substring(0, 500)
      }
      
      testResults.push({
        url: `https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics?alt=json`,
        status: response2.status,
        ok: response2.ok,
        data: data2
      })
    } catch (e) {
      testResults.push({
        url: `https://businessprofileperformance.googleapis.com/v1/locations/${normalizedLocationId}:fetchMetrics?alt=json`,
        error: e?.message
      })
    }

    return NextResponse.json({
      success: true,
      locationName,
      normalizedLocationId,
      accessToken: accessToken?.substring(0, 20) + '...',
      curlCommands: {
        fullPath: curl1,
        normalized: curl2
      },
      testResults,
      requestBody
    })

  } catch (e: any) {
    console.error('Performance API curl test error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}

