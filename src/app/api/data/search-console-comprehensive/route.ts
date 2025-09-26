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

async function fetchSearchConsoleData(accessToken: string, siteUrl: string, startDate: string, endDate: string, dimensions: string[]) {
  const requestBody = {
    startDate,
    endDate,
    dimensions,
    rowLimit: 25
  }

  // Try different API formats
  const apiFormats = [
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${siteUrl.replace('sc-domain:', '')}/searchAnalytics/query`,
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  ]

  for (let i = 0; i < apiFormats.length; i++) {
    try {
      console.log(`Trying API format ${i + 1}: ${apiFormats[i]}`)
      console.log('Request body:', requestBody)
      
      const response = await fetch(apiFormats[i], {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (response.ok) {
        const data = await response.json()
        console.log(`API format ${i + 1} succeeded`)
        return data
      } else {
        const errorData = await response.json()
        console.log(`API format ${i + 1} failed: ${response.status}`, errorData)
      }
    } catch (error) {
      console.log(`API format ${i + 1} error:`, error)
    }
  }

  throw new Error('All API formats failed')
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Get the time period from query params
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '28')

    // Get user's Search Console connection
    const { data: gscConn } = await supabase
      .from('gsc_connections')
      .select('site_url')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no connection record exists, return error
    if (!gscConn?.site_url) {
      return NextResponse.json({ 
        error: 'no_search_console_connection',
        message: 'No Search Console site connected. Please connect a Search Console site first.'
      }, { status: 400 })
    }

    const siteUrl = gscConn.site_url

    // Get access token
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

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const startDateStr = startDate.toISOString().split('T')[0]
    const endDateStr = endDate.toISOString().split('T')[0]

    console.log(`Fetching comprehensive Search Console data for ${siteUrl} from ${startDateStr} to ${endDateStr}`)

    // Fetch multiple dimensions of data
    const [queriesData, pagesData, devicesData, countriesData] = await Promise.all([
      fetchSearchConsoleData(accessToken, siteUrl, startDateStr, endDateStr, ['query']),
      fetchSearchConsoleData(accessToken, siteUrl, startDateStr, endDateStr, ['page']),
      fetchSearchConsoleData(accessToken, siteUrl, startDateStr, endDateStr, ['device']),
      fetchSearchConsoleData(accessToken, siteUrl, startDateStr, endDateStr, ['country'])
    ])

    // Process queries data
    const queries = queriesData.rows?.map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr * 100,
      position: row.position
    })) || []

    // Process pages data
    const pages = pagesData.rows?.map((row: any) => ({
      page: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr * 100,
      position: row.position
    })) || []

    // Process devices data
    const devices = devicesData.rows?.map((row: any) => ({
      device: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr * 100,
      position: row.position
    })) || []

    // Process countries data
    const countries = countriesData.rows?.map((row: any) => ({
      country: row.keys[0],
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr * 100,
      position: row.position
    })) || []

    // Calculate summary metrics
    const totalClicks = queries.reduce((sum, q) => sum + q.clicks, 0)
    const totalImpressions = queries.reduce((sum, q) => sum + q.impressions, 0)
    const avgCTR = queries.length > 0 ? queries.reduce((sum, q) => sum + q.ctr, 0) / queries.length : 0
    const avgPosition = queries.length > 0 ? queries.reduce((sum, q) => sum + q.position, 0) / queries.length : 0

    return NextResponse.json({
      queries,
      pages,
      devices,
      countries,
      summary: {
        totalClicks,
        totalImpressions,
        avgCTR: avgCTR.toFixed(2),
        avgPosition: avgPosition.toFixed(1)
      },
      dateRange: {
        start: startDateStr,
        end: endDateStr,
        days
      },
      siteUrl
    })

  } catch (e: any) {
    console.error('Comprehensive Search Console endpoint error:', e)
    
    if (e.message === 'missing_google_tokens') {
      return NextResponse.json({ error: 'missing_google_tokens' }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: 'search_console_failed', 
      detail: e.message || 'Unknown error occurred' 
    }, { status: 500 })
  }
}
