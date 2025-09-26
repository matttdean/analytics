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

async function fetchGA4Data(accessToken: string, propertyId: string, startDate: string, endDate: string) {
  const resp = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate, endDate }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'conversions' },
          { name: 'totalRevenue' }
        ],
        dimensions: [{ name: 'date' }],
      }),
    }
  )

  if (!resp.ok) {
    const error = await resp.json()
    throw new Error(`GA4 API error: ${resp.status} - ${JSON.stringify(error)}`)
  }

  return resp.json()
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Get user's GA4 connection
    const { data: ga4Conn } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ga4Conn?.property_id) {
      return NextResponse.json({ error: 'no_ga4_property_configured' }, { status: 400 })
    }

    // Get access token
    const { access } = await readToken(supabase, user.id)

    // Get days parameter
    const url = new URL(req.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '28')))

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Fetch data from Google Analytics
    const ga4Data = await fetchGA4Data(access as string, ga4Conn.property_id, startDate, endDate)

    // Process the data
    const rows = ga4Data.rows || []
    const processedData = rows.map((row: any) => ({
      date: row.dimensionValues[0].value,
      active_users: parseInt(row.metricValues[0].value) || 0,
      sessions: parseInt(row.metricValues[1].value) || 0,
      conversions: parseInt(row.metricValues[2].value) || 0,
      total_revenue: parseFloat(row.metricValues[3].value) || 0
    }))

    // Calculate totals
    const totalVisitors = processedData.reduce((sum: number, day: any) => sum + day.active_users, 0)
    const totalSessions = processedData.reduce((sum: number, day: any) => sum + day.sessions, 0)
    const totalConversions = processedData.reduce((sum: number, day: any) => sum + day.conversions, 0)
    const avgConversionRate = processedData.length > 0 
      ? (totalConversions / Math.max(totalSessions, 1)) * 100
      : 0

    return NextResponse.json({
      success: true,
      data: {
        series: processedData,
        kpis: {
          totalVisitors,
          totalSessions,
          totalConversions,
          avgConversionRate,
          dailyAverage: Math.round(totalVisitors / days)
        }
      }
    })

  } catch (error: any) {
    console.error('Visitors API error:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to fetch visitors data' 
    }, { status: 500 })
  }
}
