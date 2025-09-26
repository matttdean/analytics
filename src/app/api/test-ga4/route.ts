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

export async function GET(req: Request) {
  try {
    console.log('=== GA4 TEST API START ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Check GA4 connections
    console.log('Checking GA4 connections...')
    const { data: conn, error: connError } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (connError) {
      console.error('Connection query error:', connError)
      return NextResponse.json({ 
        success: false, 
        error: 'connection_query_failed',
        details: connError.message
      })
    }

    if (!conn?.property_id) {
      console.log('No GA4 property configured')
      return NextResponse.json({
        success: false,
        message: 'No GA4 property configured',
        connections: [],
        suggestion: 'Connect a GA4 property first'
      })
    }

    console.log('GA4 property found:', conn.property_id, conn.display_name)

    // Get Google tokens
    const { access } = await readToken(supabase, user.id)
    const accessToken = access as string

    console.log('Access token obtained, testing GA4 API access...')

    // Test GA4 API access
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 7) // Last 7 days
    
    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '')
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '')

    console.log('Testing GA4 API with dates:', startDateStr, 'to', endDateStr)

    const ga4Response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${conn.property_id}:runReport`,
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
            { name: 'sessions' },
          ],
        }),
      }
    )
    
    console.log('GA4 API response status:', ga4Response.status)
    
    if (ga4Response.ok) {
      const ga4Data = await ga4Response.json()
      console.log('GA4 API successful:', ga4Data)
      
      return NextResponse.json({
        success: true,
        message: 'GA4 API access confirmed',
        property: {
          id: conn.property_id,
          name: conn.display_name
        },
        testData: ga4Data,
        rows: ga4Data.rows?.length || 0
      })
    } else {
      const errorText = await ga4Response.text()
      console.error('GA4 API failed:', errorText)
      
      return NextResponse.json({
        success: false,
        message: 'GA4 API access failed',
        property: {
          id: conn.property_id,
          name: conn.display_name
        },
        status: ga4Response.status,
        error: errorText
      })
    }
    
  } catch (e: any) {
    console.error('GA4 test error:', e)
    return NextResponse.json({ 
      success: false,
      error: e?.message || 'unknown_error',
      details: e.toString()
    }, { status: 500 })
  }
}
