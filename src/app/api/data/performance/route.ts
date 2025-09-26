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

async function getPageSpeedInsights(url: string, apiKey?: string, accessToken?: string) {
  const params = new URLSearchParams({
    url,
    strategy: 'mobile',
    category: 'performance'
  })

  if (apiKey) {
    params.append('key', apiKey)
  }

  const response = await fetch(
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`,
    {
      headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {}
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('PageSpeed Insights failed:', response.status, errorText)
    throw new Error(`PageSpeed API failed: ${response.status}`)
  }

  return response.json()
}

async function getGA4PerformanceData(accessToken: string, propertyId: string, days: number) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const response = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
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
        metrics: [
          { name: 'screenPageViews' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      }),
    }
  )

  if (!response.ok) {
    const errorText = await response.text()
    console.error('GA4 API failed:', response.status, errorText)
    throw new Error(`GA4 API failed: ${response.status}`)
  }

  return response.json()
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '28')
    const testUrl = url.searchParams.get('url') || 'https://deandesign.co'

    console.log('Performance API called with:', { days, testUrl })

    // Get Google OAuth tokens
    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    let accessToken = access as string

    // Refresh if expiring
    if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
      const refreshed = await refreshAccessToken(refresh as string)
      accessToken = refreshed.access_token
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
      
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

    // Get GA4 property ID
    const { data: conn } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const propertyId = conn?.property_id

    // Try PageSpeed Insights with API key first, then OAuth
    const apiKey = process.env.GOOGLE_API_KEY
    let pageSpeedData = null
    let performanceScore = 0
    let coreWebVitals = {}
    let recommendations = []

    try {
      if (apiKey) {
        console.log('Using Google API key for PageSpeed Insights')
        pageSpeedData = await getPageSpeedInsights(testUrl, apiKey)
      } else {
        console.log('No API key, trying OAuth token for PageSpeed Insights')
        pageSpeedData = await getPageSpeedInsights(testUrl, undefined, accessToken)
      }

      // Extract performance data
      const audits = pageSpeedData?.lighthouseResult?.audits || {}
      performanceScore = Math.round((pageSpeedData?.lighthouseResult?.categories?.performance?.score || 0) * 100)

      coreWebVitals = {
        lcp: {
          score: Math.round((audits['largest-contentful-paint']?.numericValue || 0) / 1000 * 100) / 100,
          status: audits['largest-contentful-paint']?.score === 1 ? 'good' : 
                 audits['largest-contentful-paint']?.score === 0.5 ? 'needs-improvement' : 'poor',
          target: '< 2.5s'
        },
        fid: {
          score: Math.round((audits['max-potential-fid']?.numericValue || 0) * 100) / 100,
          status: audits['max-potential-fid']?.score === 1 ? 'good' : 
                 audits['max-potential-fid']?.score === 0.5 ? 'needs-improvement' : 'poor',
          target: '< 100ms'
        },
        cls: {
          score: Math.round((audits['cumulative-layout-shift']?.numericValue || 0) * 100) / 100,
          status: audits['cumulative-layout-shift']?.score === 1 ? 'good' : 
                 audits['cumulative-layout-shift']?.score === 0.5 ? 'needs-improvement' : 'poor',
          target: '< 0.1'
        },
        ttfb: {
          score: Math.round((audits['server-response-time']?.numericValue || 0) * 100) / 100,
          status: audits['server-response-time']?.score === 1 ? 'good' : 
                 audits['server-response-time']?.score === 0.5 ? 'needs-improvement' : 'poor',
          target: '< 200ms'
        },
        fcp: {
          score: Math.round((audits['first-contentful-paint']?.numericValue || 0) / 1000 * 100) / 100,
          status: audits['first-contentful-paint']?.score === 1 ? 'good' : 
                 audits['first-contentful-paint']?.score === 0.5 ? 'needs-improvement' : 'poor',
          target: '< 1.8s'
        }
      }

      // Get recommendations from opportunities
      recommendations = Object.entries(audits)
        .filter(([key, audit]: [string, any]) => audit.details?.type === 'opportunity' && audit.numericValue > 0)
        .slice(0, 5)
        .map(([key, audit]: [string, any]) => ({
          title: audit.title,
          description: audit.description,
          priority: audit.numericValue > 1000 ? 'High' : audit.numericValue > 500 ? 'Medium' : 'Low',
          impact: audit.numericValue > 1000 ? 'High' : audit.numericValue > 500 ? 'Medium' : 'Low',
          effort: 'Medium'
        }))

    } catch (pageSpeedError) {
      console.error('PageSpeed Insights failed:', pageSpeedError)
      // Fallback data if PageSpeed fails
      coreWebVitals = {
        lcp: { score: 0, status: 'loading', target: '< 2.5s' },
        fid: { score: 0, status: 'loading', target: '< 100ms' },
        cls: { score: 0, status: 'loading', target: '< 0.1' },
        ttfb: { score: 0, status: 'loading', target: '< 200ms' },
        fcp: { score: 0, status: 'loading', target: '< 1.8s' }
      }
      recommendations = []
    }

    // Get GA4 performance data
    let ga4Data = null
    let avgLoadTime = 0
    let pageViews = 0
    let bounceRate = 0

    if (propertyId && accessToken) {
      try {
        ga4Data = await getGA4PerformanceData(accessToken, propertyId, days)
        const rows = ga4Data?.rows?.[0]?.metricValues || []
        
        if (rows.length >= 3) {
          pageViews = parseInt(rows[0]?.value || '0')
          const avgSessionDuration = parseFloat(rows[1]?.value || '0')
          bounceRate = parseFloat(rows[2]?.value || '0')
          
          // Estimate load time based on session duration and page views
          avgLoadTime = pageViews > 0 ? (avgSessionDuration / pageViews) : 0
        }
      } catch (ga4Error) {
        console.error('GA4 performance data failed:', ga4Error)
      }
    }

    return NextResponse.json({
      performanceScore,
      coreWebVitals,
      recommendations,
      avgLoadTime: Math.round(avgLoadTime * 100) / 100,
      pageViews,
      bounceRate: Math.round(bounceRate * 100) / 100,
      testUrl,
      days
    })

  } catch (error: any) {
    console.error('Performance API error:', error)
    return NextResponse.json({ 
      error: error.message || 'unknown_error',
      message: 'Failed to fetch performance data'
    }, { status: 500 })
  }
}
