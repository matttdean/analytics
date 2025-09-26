import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

async function refreshAccessToken(refreshToken: string) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  
  if (!r.ok) {
    const j = await r.json()
    throw new Error(`refresh_failed:${j?.error || r.status}`)
  }
  return r.json() as { access_token: string; expires_in: number; token_type: string }
}

export async function GET(req: Request) {
  try {
    console.log('=== GSC SITES API CALLED ===')
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('User auth result:', { user: user?.id, error: userError?.message })
    
    if (userError) {
      console.error('User auth error:', userError)
      return NextResponse.json({ error: 'auth_error', message: userError.message }, { status: 401 })
    }
    
    if (!user) {
      console.log('No user found in session')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Get access token
    console.log('Reading Google tokens for user:', user.id)
    const { getAuthorizedAccessToken } = await import('@/lib/google')
    
    let accessToken: string
    try {
      accessToken = await getAuthorizedAccessToken(user.id)
      console.log('Token retrieved successfully, length:', accessToken.length)
    } catch (tokenError: any) {
      console.log('Token retrieval failed:', tokenError.message)
      return NextResponse.json({ 
        error: 'no_access_token',
        message: 'No Google access token found. Please reconnect your Google account.'
      }, { status: 400 })
    }

    // getAuthorizedAccessToken already handles token refresh internally

    // Get user's Search Console connections
    const { data: gscConnections, error: gscError } = await supabase
      .from('gsc_connections')
      .select('site_url')
      .eq('user_id', user.id)

    if (gscError) {
      console.error('Error fetching GSC connections:', gscError)
      return NextResponse.json({ error: 'failed_to_fetch_connections' }, { status: 500 })
    }

    // If no existing connections, try to discover available sites from Google
    if (!gscConnections || gscConnections.length === 0) {
      try {
        console.log('Making request to Search Console API with token:', accessToken.substring(0, 20) + '...')
        // Try to get available sites from Google Search Console API
        const resp = await fetch(
          'https://searchconsole.googleapis.com/webmasters/v3/sites',
          {
            headers: {
              authorization: `Bearer ${accessToken}`,
              'content-type': 'application/json',
            },
          }
        )
        
        console.log('Search Console API response status:', resp.status)

        if (resp.ok) {
          const siteData = await resp.json()
          console.log('Discovered available GSC sites:', siteData)
          
          if (siteData.siteEntry && siteData.siteEntry.length > 0) {
            const availableSites = siteData.siteEntry.map((entry: any) => ({
              siteUrl: entry.siteUrl,
              permissionLevel: entry.permissionLevel || 'unknown',
              available: true
            }))
            
            return NextResponse.json({ 
              sites: availableSites,
              message: 'Available sites found. Use the connect button to add them.',
              needsConnection: true
            })
          } else {
            console.log('No site entries found in response:', siteData)
            return NextResponse.json({ 
              sites: [],
              message: 'No Search Console sites found. Make sure you have verified sites in Google Search Console.',
              needsConnection: true
            })
          }
        } else {
          const errorText = await resp.text()
          console.error('Search Console API error:', resp.status, errorText)
          return NextResponse.json({ 
            error: 'search_console_api_error',
            message: `Search Console API error: ${resp.status} - ${errorText}`,
            sites: [],
            needsConnection: true
          }, { status: 400 })
        }
      } catch (error) {
        console.error('Could not discover available sites:', error)
        return NextResponse.json({ 
          error: 'discovery_failed',
          message: `Failed to discover sites: ${error instanceof Error ? error.message : 'Unknown error'}`,
          sites: [],
          needsConnection: true
        }, { status: 500 })
      }
    }

    // Return existing connections
    return NextResponse.json({
      sites: gscConnections.map((conn: any) => ({
        siteUrl: conn.site_url,
        permissionLevel: 'owner',
        available: true
      })),
      message: 'Existing Search Console connections found.',
      needsConnection: false
    })

  } catch (error: any) {
    console.error('GSC sites endpoint error:', error)
    console.error('Error stack:', error?.stack)
    return NextResponse.json({
      error: 'internal_error',
      message: error.message || 'Failed to fetch Search Console sites',
      details: error?.toString()
    }, { status: 500 })
  }
}