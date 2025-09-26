import { NextRequest, NextResponse } from 'next/server';
import { buildSuggestedGoals } from '@/lib/goalEngine';
import { createWritableClient } from '@/lib/supabase/server';
import { decrypt } from '@/lib/crypto';

type GA4Row = { /* shape from your helpers */ };

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

async function fetchGA4Summary(days: number, accessToken: string, propertyId: string) {
  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '')
  const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '')

  console.log('Fetching GA4 data for dates:', startDateStr, 'to', endDateStr)

  // Fetch summary metrics from GA4
  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'eventCount' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'screenPageViews' },
        ],
        dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      }),
    }
  )

  if (!response.ok) {
    const errorData = await response.json()
    console.error('GA4 API error response:', errorData)
    throw new Error(`GA4 API error: ${response.status}`)
  }

  const data = await response.json()
  console.log('GA4 API response received, rows:', data.rows?.length || 0)
  
  // Process the response to extract metrics
  let totalUsers = 0
  let newUsers = 0
  let sessions = 0
  let eventCount = 0
  let engagementRate = 0
  let avgSessionDuration = 0
  let bounceRate = 0
  let screenPageViews = 0

  if (data.rows) {
    data.rows.forEach((row: any) => {
      const metrics = row.metricValues
      totalUsers += parseInt(metrics[0]?.value || '0')
      newUsers += parseInt(metrics[1]?.value || '0')
      sessions += parseInt(metrics[2]?.value || '0')
      eventCount += parseInt(metrics[3]?.value || '0')
      engagementRate += parseFloat(metrics[4]?.value || '0')
      avgSessionDuration += parseFloat(metrics[5]?.value || '0')
      bounceRate += parseFloat(metrics[6]?.value || '0')
      screenPageViews += parseInt(metrics[7]?.value || '0')
    })
  }

  // Calculate derived metrics
  const conversionRate = sessions > 0 ? eventCount / sessions : 0
  const pagesPerSession = sessions > 0 ? screenPageViews / sessions : 0
  const returningUsers = totalUsers - newUsers

  const result = {
    totalUsers,
    newUsers,
    sessions,
    conversions: eventCount, // Using eventCount as proxy for conversions
    conversionRate,
    engagementRate: engagementRate / Math.max(data.rows?.length || 1, 1), // Average engagement rate
    avgSessionDurationSec: avgSessionDuration / Math.max(data.rows?.length || 1, 1),
    bounceRate: bounceRate / Math.max(data.rows?.length || 1, 1),
    returningUsers,
    pagesPerSession,
  };

  console.log('Processed GA4 summary data:', result)
  return result
}

async function fetchTopLandingPages(days: number, accessToken: string, propertyId: string) {
  // Calculate date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '')
  const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '')

  try {
    const response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
          metrics: [
            { name: 'sessions' },
            { name: 'bounceRate' },
            { name: 'eventCount' },
          ],
          dimensions: [{ name: 'pagePath' }],
          limit: 10,
        }),
      }
    )

    if (!response.ok) {
      console.warn('Failed to fetch landing pages, using fallback')
      return [
        { path: '/', sessions: 100, bounceRate: 0.65, convRate: 0.02 },
      ]
    }

    const data = await response.json()
    
    if (!data.rows) {
      return [
        { path: '/', sessions: 100, bounceRate: 0.65, convRate: 0.02 },
      ]
    }

    return data.rows.map((row: any) => {
      const metrics = row.metricValues
      const sessions = parseInt(metrics[0]?.value || '0')
      const bounceRate = parseFloat(metrics[1]?.value || '0')
      const eventCount = parseInt(metrics[2]?.value || '0')
      const convRate = sessions > 0 ? eventCount / sessions : 0

      return {
        path: row.dimensionValues[0]?.value || '/',
        sessions,
        bounceRate,
        convRate,
      }
    }).filter(page => page.sessions >= 50) // Only show pages with meaningful traffic
  } catch (error) {
    console.warn('Error fetching landing pages:', error)
    return [
      { path: '/', sessions: 100, bounceRate: 0.65, convRate: 0.02 },
    ]
  }
}

async function fetchGBP(days: number, accessToken: string) {
  try {
    console.log('Fetching GBP Performance API data...')
    
    // Calculate date range for GBP API (uses YYYY-MM-DD format)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]
    
    console.log('GBP date range:', startDateStr, 'to', endDateStr)
    
    // First, get the account location to find the location name
    const accountResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      }
    )
    
    if (!accountResponse.ok) {
      console.warn('Failed to fetch GBP accounts:', accountResponse.status)
      return undefined
    }
    
    const accountData = await accountResponse.json()
    const account = accountData.accounts?.[0]
    
    if (!account) {
      console.warn('No GBP accounts found')
      return undefined
    }
    
    console.log('GBP account found:', account.name)
    
    // Get locations for this account
    const locationsResponse = await fetch(
      `https://mybusinessaccountmanagement.googleapis.com/v1/${account.name}/locations`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      }
    )
    
    if (!locationsResponse.ok) {
      console.warn('Failed to fetch GBP locations:', locationsResponse.status)
      return undefined
    }
    
    const locationsData = await locationsResponse.json()
    const location = locationsData.locations?.[0]
    
    if (!location) {
      console.warn('No GBP locations found')
      return undefined
    }
    
    console.log('GBP location found:', location.name)
    
    // Get daily metrics for the specified date range
    const metricsResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${location.name}:getDailyMetricsTimeSeries`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          dailyMetric: 'CALL_CLICKS',
          dateRange: {
            startDate: startDateStr,
            endDate: endDateStr,
          },
        }),
      }
    )
    
    if (!metricsResponse.ok) {
      console.warn('Failed to fetch GBP metrics:', metricsResponse.status)
      return undefined
    }
    
    const metricsData = await metricsResponse.json()
    console.log('GBP metrics response:', metricsData)
    
    // Extract metrics from the response
    let totalCalls = 0
    let totalWebsiteClicks = 0
    let totalDirectionRequests = 0
    
    if (metricsData.timeSeriesData) {
      metricsData.timeSeriesData.forEach((day: any) => {
        if (day.dailyMetricValues) {
          day.dailyMetricValues.forEach((metric: any) => {
            if (metric.metric === 'CALL_CLICKS') {
              totalCalls += parseInt(metric.value || '0')
            }
          })
        }
      })
    }
    
    // Get previous period data for comparison
    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - days)
    const prevEndDate = new Date(startDate)
    prevEndDate.setDate(prevEndDate.getDate() - 1)
    
    const prevStartDateStr = prevStartDate.toISOString().split('T')[0]
    const prevEndDateStr = prevEndDate.toISOString().split('T')[0]
    
    let prevPeriodCalls = 0
    
    try {
      const prevMetricsResponse = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${location.name}:getDailyMetricsTimeSeries`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            dailyMetric: 'CALL_CLICKS',
            dateRange: {
              startDate: prevStartDateStr,
              endDate: prevEndDateStr,
            },
          }),
        }
      )
      
      if (prevMetricsResponse.ok) {
        const prevMetricsData = await prevMetricsResponse.json()
        if (prevMetricsData.timeSeriesData) {
          prevMetricsData.timeSeriesData.forEach((day: any) => {
            if (day.dailyMetricValues) {
              day.dailyMetricValues.forEach((metric: any) => {
                if (metric.metric === 'CALL_CLICKS') {
                  prevPeriodCalls += parseInt(metric.value || '0')
                }
              })
            }
          })
        }
      }
    } catch (error) {
      console.warn('Failed to fetch previous period GBP data:', error)
    }
    
    // Get business information for reviews and rating
    const businessInfoResponse = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${location.name}`,
      {
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
      }
    )
    
    let reviews = 0
    let avgRating = 0
    let responseRate = 0
    
    if (businessInfoResponse.ok) {
      const businessInfo = await businessInfoResponse.json()
      // Note: GBP API doesn't provide review count/rating directly
      // These would need to be fetched from a different endpoint or stored separately
      console.log('Business info:', businessInfo)
    }
    
    const gbpData = {
      calls: totalCalls,
      callsPrev: prevPeriodCalls,
      websiteClicks: totalWebsiteClicks,
      directionRequests: totalDirectionRequests,
      reviews: reviews,
      avgRating: avgRating,
      responseRate: responseRate,
    }
    
    console.log('Processed GBP data:', gbpData)
    return gbpData
    
  } catch (error) {
    console.error('Error fetching GBP data:', error)
    return undefined
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log('=== GOALS SUGGEST API START ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('No user found')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    const url = new URL(req.url);
    const days = parseInt(url.searchParams.get('days') || '28', 10);
    console.log('Requested days:', days)

    // Get user's GA4 property
    const { data: conn, error: connError } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (connError) {
      console.error('Connection query error:', connError)
    }

    if (!conn?.property_id) {
      console.log('No GA4 property configured, using fallback data')
      // Return fallback data if no property configured
      const fallbackSnapshot = {
        days,
        totals: {
          totalUsers: 1200,
          newUsers: 800,
          sessions: 1600,
          conversions: 48,
          conversionRate: 0.03,
          engagementRate: 0.52,
          avgSessionDurationSec: 118,
          bounceRate: 0.58,
          returningUsers: 400,
          pagesPerSession: 1.3,
        },
        breakdowns: {
          topLandingPages: [
            { path: '/services', sessions: 420, bounceRate: 0.67, convRate: 0.021 },
            { path: '/pricing', sessions: 260, bounceRate: 0.54, convRate: 0.038 },
          ]
        },
        gbp: undefined,
      };

      const suggested = buildSuggestedGoals(fallbackSnapshot);
      return NextResponse.json({
        suggestedGoals: suggested,
        snapshot: fallbackSnapshot,
        note: 'Using fallback data - connect GA4 for real insights'
      });
    }

    console.log('GA4 property found:', conn.property_id)

    try {
      // Get and refresh Google tokens
      console.log('Reading Google tokens...')
      const { access, refresh, expiresAt } = await readToken(supabase, user.id)
      let accessToken = access as string

      console.log('Token expiry:', expiresAt ? new Date(expiresAt).toISOString() : 'No expiry')

      // Refresh if expiring (buffer 60s)
      if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
        console.log('Refreshing access token...')
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
        
        console.log('Access token refreshed and persisted')
      }

      console.log('Fetching GA4 summary data...')
      const totals = await fetchGA4Summary(days, accessToken, conn.property_id);
      console.log('GA4 summary data:', totals)

      console.log('Fetching top landing pages...')
      const topLandingPages = await fetchTopLandingPages(days, accessToken, conn.property_id);
      console.log('Top landing pages:', topLandingPages)

      console.log('Fetching GBP data...')
      const gbp = await fetchGBP(days, accessToken).catch(() => undefined);
      console.log('GBP data:', gbp);

      const snapshot = {
        days,
        totals,
        breakdowns: { topLandingPages },
        gbp,
      };

      console.log('Building suggested goals from real data...')
      const suggested = buildSuggestedGoals(snapshot);
      console.log('Generated suggestions:', suggested.length, 'goals')

      return NextResponse.json({
        suggestedGoals: suggested,
        snapshot,
        note: 'Real GA4 + GBP data'
      });
    } catch (ga4Error) {
      console.error('GA4 API failed, using fallback data:', ga4Error)
      
      // Return fallback data when GA4 API fails
      const fallbackSnapshot = {
        days,
        totals: {
          totalUsers: 1200,
          newUsers: 800,
          sessions: 1600,
          conversions: 48,
          conversionRate: 0.03,
          engagementRate: 0.52,
          avgSessionDurationSec: 118,
          bounceRate: 0.58,
          returningUsers: 400,
          pagesPerSession: 1.3,
        },
        breakdowns: {
          topLandingPages: [
            { path: '/services', sessions: 420, bounceRate: 0.67, convRate: 0.021 },
            { path: '/pricing', sessions: 260, bounceRate: 0.54, convRate: 0.038 },
          ]
        },
        gbp: undefined,
      };

      const suggested = buildSuggestedGoals(fallbackSnapshot);
      return NextResponse.json({
        suggestedGoals: suggested,
        snapshot: fallbackSnapshot,
        note: 'Using fallback data - GA4 API temporarily unavailable',
        error: ga4Error.message
      });
    }
  } catch (e: any) {
    console.error('Goals suggest error:', e)
    
    // Even if everything fails, return some basic suggestions
    const emergencySnapshot = {
      days: 28,
      totals: {
        totalUsers: 1000,
        newUsers: 700,
        sessions: 1400,
        conversions: 35,
        conversionRate: 0.025,
        engagementRate: 0.48,
        avgSessionDurationSec: 95,
        bounceRate: 0.62,
        returningUsers: 300,
        pagesPerSession: 1.2,
      },
      breakdowns: {
        topLandingPages: [
          { path: '/', sessions: 300, bounceRate: 0.65, convRate: 0.02 },
        ]
      },
      gbp: undefined,
    };

    const suggested = buildSuggestedGoals(emergencySnapshot);
    return NextResponse.json({
      suggestedGoals: suggested,
      snapshot: emergencySnapshot,
      note: 'Using emergency fallback data',
      error: e.message
    });
  }
}
