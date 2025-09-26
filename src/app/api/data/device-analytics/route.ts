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
  if (!r.ok) {
    throw new Error(`refresh_failed:${j?.error || r.status}`)
  }
  return j as { access_token: string; expires_in: number; token_type: string }
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Get days parameter from query string
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '28')
    
    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get GA4 connection to get property ID
    const { data: conn } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!conn?.property_id) {
      return NextResponse.json({ error: 'no_property_configured' }, { status: 400 })
    }

    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    let accessToken = access as string

    // Refresh if expiring (buffer 60s)
    if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
      const refreshed = await refreshAccessToken(refresh as string)
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
      
      // Persist the new access token
      const { encrypt } = await import('@/lib/crypto')
      const encA = encrypt(refreshed.access_token)
      
      await supabase
        .from('google_oauth_tokens')
        .update({ 
          access_token_cipher: encA.cipher,
          access_token_iv: encA.iv.toString('base64'),
          access_token_tag: encA.tag.toString('base64'),
          expiry: newExpiresAt 
        })
        .eq('user_id', user.id)
    }

    // Fetch device data from GA4
    const deviceResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
            },
          ],
          dimensions: [{ name: 'deviceCategory' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10
        }),
      }
    )

    // Fetch browser data from GA4
    const browserResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
            },
          ],
          dimensions: [{ name: 'browser' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10
        }),
      }
    )

    // Fetch OS data from GA4
    const osResponse = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
            },
          ],
          dimensions: [{ name: 'operatingSystem' }],
          metrics: [{ name: 'sessions' }],
          orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
          limit: 10
        }),
      }
    )

    if (!deviceResponse.ok || !browserResponse.ok || !osResponse.ok) {
      console.error('GA4 API error:', { device: deviceResponse.status, browser: browserResponse.status, os: osResponse.status })
      return NextResponse.json({ error: 'ga_api_failed' }, { status: 500 })
    }

    const deviceData = await deviceResponse.json()
    const browserData = await browserResponse.json()
    const osData = await osResponse.json()
    
    // Process device data
    const devices = deviceData.rows?.map((row: any) => {
      const device = row.dimensionValues[0].value
      const sessions = parseInt(row.metricValues[0].value)
      
      // Map device categories to friendly names
      let deviceName = device
      if (device === 'desktop') deviceName = 'Desktop'
      else if (device === 'mobile') deviceName = 'Mobile'
      else if (device === 'tablet') deviceName = 'Tablet'
      
      return {
        device: deviceName,
        sessions,
        percentage: 0 // Will be calculated below
      }
    }) || []

    // Process browser data
    const browsers = browserData.rows?.map((row: any) => {
      const browser = row.dimensionValues[0].value
      const sessions = parseInt(row.metricValues[0].value)
      
      return {
        browser,
        sessions,
        percentage: 0 // Will be calculated below
      }
    }) || []

    // Process OS data
    const operatingSystems = osData.rows?.map((row: any) => {
      const os = row.dimensionValues[0].value
      const sessions = parseInt(row.metricValues[0].value)
      
      return {
        os,
        sessions,
        percentage: 0 // Will be calculated below
      }
    }) || []

    // Calculate percentages for each category
    const totalDeviceSessions = devices.reduce((sum, item) => sum + item.sessions, 0)
    devices.forEach(item => {
      item.percentage = Math.round((item.sessions / totalDeviceSessions) * 100)
    })

    const totalBrowserSessions = browsers.reduce((sum, item) => sum + item.sessions, 0)
    browsers.forEach(item => {
      item.percentage = Math.round((item.sessions / totalBrowserSessions) * 100)
    })

    const totalOSSessions = operatingSystems.reduce((sum, item) => sum + item.sessions, 0)
    operatingSystems.forEach(item => {
      item.percentage = Math.round((item.sessions / totalOSSessions) * 100)
    })

    return NextResponse.json({
      devices,
      browsers,
      operatingSystems,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days
      }
    })

  } catch (e: any) {
    console.error('Device analytics endpoint error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
