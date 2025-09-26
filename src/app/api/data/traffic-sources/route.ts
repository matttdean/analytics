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

    // Fetch traffic sources data from GA4
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
          dimensions: [
            { name: 'sessionSource' },
            { name: 'sessionMedium' }
          ],
          metrics: [
            { name: 'sessions' },
            { name: 'totalUsers' },
            { name: 'bounceRate' }
          ],
          orderBys: [
            { metric: { metricName: 'sessions' }, desc: true }
          ],
          limit: 10
        }),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      console.error('GA4 API error:', errorData)
      return NextResponse.json({ error: 'ga_api_failed', detail: errorData }, { status: response.status })
    }

    const data = await response.json()
    
    // Process the data to create traffic sources
    const trafficSources = data.rows?.map((row: any) => {
      const source = row.dimensionValues[0].value
      const medium = row.dimensionValues[1].value
      const sessions = parseInt(row.metricValues[0].value)
      const users = parseInt(row.metricValues[1].value)
      const bounceRate = parseFloat(row.metricValues[2].value)
      
      // Create a readable source name
      let sourceName = source
      if (medium && medium !== '(none)') {
        sourceName = `${source} (${medium})`
      }
      
      // Map common sources to friendly names
      if (source === '(direct)' && medium === '(none)') sourceName = 'Direct'
      else if (source === 'google' && medium === 'organic') sourceName = 'Organic Search'
      else if (source === 'google' && medium === 'cpc') sourceName = 'Google Ads'
      else if (source === 'facebook' || source === 'instagram') sourceName = 'Social Media'
      else if (source === 'email' || medium === 'email') sourceName = 'Email'
      else if (medium === 'referral') sourceName = 'Referral'
      
      return {
        source: sourceName,
        sessions,
        users,
        bounceRate: (bounceRate * 100).toFixed(1),
        percentage: 0 // Will be calculated below
      }
    }) || []

    // Calculate percentages
    const totalSessions = trafficSources.reduce((sum, item) => sum + item.sessions, 0)
    trafficSources.forEach(item => {
      item.percentage = Math.round((item.sessions / totalSessions) * 100)
    })

    // Add trend data (mock for now - could be enhanced with historical comparison)
    trafficSources.forEach(item => {
      item.trend = Math.random() > 0.5 ? `+${Math.floor(Math.random() * 20) + 1}%` : `-${Math.floor(Math.random() * 10) + 1}%`
    })

    return NextResponse.json({
      trafficSources,
      totalSessions,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
        days
      }
    })

  } catch (e: any) {
    console.error('Traffic sources endpoint error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
