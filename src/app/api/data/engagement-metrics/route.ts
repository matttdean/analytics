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

    // Fetch daily engagement metrics from GA4
    const response = await fetch(
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
          dimensions: [{ name: 'date' }],
          metrics: [
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'averageSessionDuration' },
            { name: 'screenPageViewsPerSession' },
            { name: 'conversions' }
          ],
          orderBys: [{ dimension: { dimensionName: 'date' } }],
          limit: 100
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('GA4 API error:', errorData)
      return NextResponse.json({ error: 'ga_api_failed', detail: errorData }, { status: response.status })
    }

    const data = await response.json()
    
    // Process the data to create daily engagement metrics
    const engagementData = data.rows?.map((row: any) => {
      const date = row.dimensionValues[0].value
      const sessions = parseInt(row.metricValues[0].value)
      const bounceRate = parseFloat(row.metricValues[1].value)
      const sessionDuration = parseFloat(row.metricValues[2].value)
      const pagesPerSession = parseFloat(row.metricValues[3].value)
      const conversions = parseFloat(row.metricValues[4].value)
      
      // Calculate conversion rate (conversions per session)
      const conversionRate = sessions > 0 ? (conversions / sessions) * 100 : 0
      
      return {
        date,
        sessions,
        bounce_rate: (bounceRate * 100).toFixed(1),
        session_duration: Math.round(sessionDuration),
        pages_per_session: pagesPerSession.toFixed(1),
        conversion_rate: conversionRate.toFixed(1)
      }
    }) || []

    // Calculate overall averages
    const totalSessions = engagementData.reduce((sum, item) => sum + item.sessions, 0)
    const avgBounceRate = engagementData.length > 0 
      ? (engagementData.reduce((sum, item) => sum + parseFloat(item.bounce_rate), 0) / engagementData.length).toFixed(1)
      : '0'
    const avgSessionDuration = engagementData.length > 0
      ? Math.round(engagementData.reduce((sum, item) => sum + item.session_duration, 0) / engagementData.length)
      : 0
    const avgPagesPerSession = engagementData.length > 0
      ? (engagementData.reduce((sum, item) => sum + parseFloat(item.pages_per_session), 0) / engagementData.length).toFixed(1)
      : '0'
    const avgConversionRate = engagementData.length > 0
      ? (engagementData.reduce((sum, item) => sum + parseFloat(item.conversion_rate), 0) / engagementData.length).toFixed(1)
      : '0'

    return NextResponse.json({
      engagementData,
      summary: {
        totalSessions,
        avgBounceRate,
        avgSessionDuration,
        avgPagesPerSession,
        avgConversionRate
      },
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days
      }
    })

  } catch (e: any) {
    console.error('Engagement metrics endpoint error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
