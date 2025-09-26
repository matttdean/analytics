import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decrypt } from '@/lib/crypto'

// Helper function to format date as YYYY-MM-DD
function fmt(d: Date) {
  return d.toISOString().split('T')[0]
}

// GA4 data fetcher
async function fetchGA4Data(accessToken: string, propertyId: string, start: string, end: string) {
  const formattedPropertyId = propertyId.startsWith('properties/') ? propertyId : `properties/${propertyId}`
  const url = `https://analyticsdata.googleapis.com/v1beta/${formattedPropertyId}:runReport`
  
  const body = {
    dateRanges: [{ startDate: start, endDate: end }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'conversions' }, { name: 'totalRevenue' }],
    dimensions: [{ name: 'date' }],
  }
  
  const res = await fetch(url, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${accessToken}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify(body),
  })
  
  if (!res.ok) {
    const errorText = await res.text()
    throw new Error(`GA4 report failed: ${res.status} - ${errorText}`)
  }
  
  const json = await res.json()
  return (json.rows || []).map((r: any) => ({
    date: r.dimensionValues[0].value as string,
    active_users: Number(r.metricValues[0]?.value || 0),
    sessions: Number(r.metricValues[1]?.value || 0),
    conversions: Number(r.metricValues[2]?.value || 0),
    total_revenue: Number(r.metricValues[3]?.value || 0),
  }))
}

// Refresh access token
async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }).toString()

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const text = await r.text()
  let j: any = {}
  try { j = text ? JSON.parse(text) : {} } catch {}
  if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}:${text?.slice(0,200)}`)
  return j as { access_token: string; expires_in: number; token_type: string }
}

// Get access token for user
async function getAccessToken(supabase: any, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) {
    throw new Error(`No Google tokens found for user ${userId}`)
  }

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
    
    // Check if token is expired or near expiry (60s buffer)
    if (expiresAt && Date.now() > expiresAt - 60_000 && refresh) {
      const refreshed = await refreshAccessToken(refresh as string)
      
      // Update the stored token
      const { encrypt } = await import('@/lib/crypto')
      const encA = encrypt(refreshed.access_token)
      const newExpiresAt = new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString()
      
      await supabase
        .from('google_oauth_tokens')
        .update({
          access_token_cipher: encA.cipher,
          access_token_iv: encA.iv.toString('base64'),
          access_token_tag: encA.tag.toString('base64'),
          expiry: newExpiresAt
        })
        .eq('user_id', userId)
      
      return refreshed.access_token
    }
    
    return access as string
  } catch (decryptError) {
    console.error('Token decryption failed:', decryptError)
    throw new Error(`Token decryption failed for user ${userId}`)
  }
}

export async function POST(req: Request) {
  try {
    // Optional: Add authentication for cron jobs
    const auth = req.headers.get('authorization') || ''
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    console.log('=== BACKGROUND SYNC START ===')
    
    // Use service role client for background operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all users with GA4 connections
    const { data: ga4Connections, error: connError } = await supabase
      .from('ga4_connections')
      .select('user_id, property_id, display_name')

    if (connError) {
      throw new Error(`Failed to fetch GA4 connections: ${connError.message}`)
    }

    if (!ga4Connections || ga4Connections.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'No GA4 connections found',
        synced: 0 
      })
    }

    // Sync last 7 days for all users
    const end = new Date()
    const start = new Date(Date.now() - 6 * 86400_000) // 7 days
    const startStr = fmt(start)
    const endStr = fmt(end)

    let totalSynced = 0
    const results = []

    for (const connection of ga4Connections) {
      try {
        console.log(`Syncing for user ${connection.user_id}, property ${connection.property_id}`)
        
        // Get access token
        const accessToken = await getAccessToken(supabase, connection.user_id)
        
        // Fetch GA4 data
        const ga4Rows = await fetchGA4Data(accessToken, connection.property_id, startStr, endStr)
        
        if (ga4Rows.length > 0) {
          // Upsert data to ga4_daily table
          const payload = ga4Rows.map((r) => ({
            user_id: connection.user_id,
            property_id: connection.property_id,
            date: r.date,
            sessions: r.sessions,
            active_users: r.active_users,
            conversions: r.conversions,
            total_revenue: r.total_revenue,
          }))

          const { error: upsertError } = await supabase
            .from('ga4_daily')
            .upsert(payload, {
              onConflict: 'user_id,property_id,date'
            })

          if (upsertError) {
            console.error(`Failed to upsert data for user ${connection.user_id}:`, upsertError)
            results.push({
              userId: connection.user_id,
              propertyId: connection.property_id,
              status: 'error',
              error: upsertError.message
            })
          } else {
            totalSynced += payload.length
            results.push({
              userId: connection.user_id,
              propertyId: connection.property_id,
              status: 'success',
              rows: payload.length
            })
          }
        }
      } catch (error: any) {
        console.error(`Sync failed for user ${connection.user_id}:`, error.message)
        results.push({
          userId: connection.user_id,
          propertyId: connection.property_id,
          status: 'error',
          error: error.message
        })
      }
    }

    console.log(`Background sync completed. Total rows synced: ${totalSynced}`)

    return NextResponse.json({
      success: true,
      message: 'Background sync completed',
      synced: totalSynced,
      dateRange: { start: startStr, end: endStr },
      results
    })

  } catch (error: any) {
    console.error('Background sync error:', error)
    return NextResponse.json({ 
      error: 'background_sync_failed',
      message: error?.message || 'Unknown error occurred',
      details: error.toString()
    }, { status: 500 })
  }
}

