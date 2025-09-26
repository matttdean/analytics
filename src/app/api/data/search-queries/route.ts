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

    // Get the time period from query params
    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '28')

    // Get user's Search Console connection, or use default if none exists
    const { data: gscConn } = await supabase
      .from('gsc_connections')
      .select('site_url')
      .eq('user_id', user.id)
      .maybeSingle()

    // If no connection record exists, use the default site URL since OAuth is working
    const siteUrl = gscConn?.site_url || 'sc-domain:deandesign.co'

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

    console.log(`Fetching Search Console data for ${siteUrl} from ${startDateStr} to ${endDateStr}`)

    // Try to fetch real data from Search Console API
    let queries = []
    let error = null

    try {
      // Try multiple API formats for domain properties
      const apiFormats = [
        // Format 1: Remove sc-domain: prefix
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl.replace('sc-domain:', ''))}/searchAnalytics/query`,
        // Format 2: Use full domain property format
        `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
        // Format 3: Try v1 API with domain property
        `https://searchconsole.googleapis.com/v1/sites/${encodeURIComponent(siteUrl)}:searchAnalytics/query`
      ]

      const requestBody = {
        startDate: startDateStr,
        endDate: endDateStr,
        dimensions: ['query'],
        rowLimit: 25
      }

      console.log('Request body:', requestBody)

      // Try each API format until one works
      for (let i = 0; i < apiFormats.length; i++) {
        const apiUrl = apiFormats[i]
        console.log(`Trying API format ${i + 1}:`, apiUrl)

        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          })

          if (response.ok) {
            const data = await response.json()
            console.log('Search Console API response:', data)
            
            if (data.rows && data.rows.length > 0) {
              queries = data.rows.map((row: any) => ({
                query: row.keys[0],
                clicks: row.clicks,
                impressions: row.impressions,
                ctr: row.ctr * 100, // Convert to percentage
                position: row.position,
                date: endDateStr
              }))
              console.log(`Successfully fetched ${queries.length} queries using format ${i + 1}`)
              break // Exit the loop if successful
            }
          } else {
            const errorText = await response.text()
            console.log(`API format ${i + 1} failed:`, response.status, errorText)
            if (i === apiFormats.length - 1) {
              // Last format failed, set the error
              error = `All API formats failed. Last error: ${response.status}`
            }
          }
        } catch (formatError) {
          console.log(`API format ${i + 1} error:`, formatError)
          if (i === apiFormats.length - 1) {
            // Last format failed, set the error
            error = `All API formats failed. Last error: ${formatError}`
          }
        }
      }
    } catch (apiError) {
      console.error('Error calling Search Console API:', apiError)
      error = `API call failed: ${apiError}`
    }

    // If we got real data, return it
    if (queries.length > 0) {
      return NextResponse.json({
        queries,
        mock: false,
        siteUrl: siteUrl,
        days: days
      })
    }

    // If no real data, return mock data with error info
    const mockQueries = [
      {
        query: 'web design services',
        clicks: 45,
        impressions: 1200,
        ctr: 3.75,
        position: 2.3,
        date: endDateStr
      },
      {
        query: 'graphic design portfolio',
        clicks: 38,
        impressions: 890,
        ctr: 4.27,
        position: 1.8,
        date: endDateStr
      },
      {
        query: 'logo design company',
        clicks: 32,
        impressions: 750,
        ctr: 4.27,
        position: 2.1,
        date: endDateStr
      },
      {
        query: 'brand identity design',
        clicks: 28,
        impressions: 680,
        ctr: 4.12,
        position: 2.5,
        date: endDateStr
      },
      {
        query: 'UI/UX design services',
        clicks: 25,
        impressions: 520,
        ctr: 4.81,
        position: 1.9,
        date: endDateStr
      }
    ]

    const response = {
      queries: mockQueries,
      mock: true,
      error: error || 'No real data available',
      note: `Unable to fetch real data from Search Console. ${error ? `Error: ${error}` : 'This shows what the data would look like if it were accessible.'}`,
      siteUrl: siteUrl,
      days: days
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Search queries endpoint error:', error)
    return NextResponse.json({ error: error.message || 'unknown_error' }, { status: 500 })
  }
} 