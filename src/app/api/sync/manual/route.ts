import { NextRequest, NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getAuthorizedAccessToken } from '@/lib/google'

// Admin Supabase client (service role bypasses RLS)
const ADMIN = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const supabase = await createWritableClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }

    // Get user's GA4 connection
    const { data: connection, error: connectionError } = await supabase
      .from('ga4_connections')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (connectionError || !connection) {
      return NextResponse.json({ error: 'no_ga4_connection' }, { status: 400 })
    }

    // Get access token
    const accessToken = await getAuthorizedAccessToken(user.id)
    if (!accessToken) {
      return NextResponse.json({ error: 'no_access_token' }, { status: 400 })
    }

    // Format property ID correctly
    const propertyId = connection.property_id.startsWith('properties/') 
      ? connection.property_id 
      : `properties/${connection.property_id}`

    // Fetch GA4 data
    const ga4Response = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: '2024-01-01',
              endDate: new Date().toISOString().split('T')[0]
            }
          ],
          metrics: [
            { name: 'activeUsers' },
            { name: 'sessions' },
            { name: 'conversions' },
            { name: 'totalRevenue' }
          ],
          dimensions: [{ name: 'date' }]
        })
      }
    )

    if (!ga4Response.ok) {
      const errorText = await ga4Response.text()
      return NextResponse.json({ 
        error: 'ga4_report_failed', 
        message: `${ga4Response.status} - ${errorText}` 
      }, { status: 400 })
    }

    const ga4Data = await ga4Response.json()
    console.log('🔍 GA4 API response:', {
      hasRows: !!ga4Data.rows,
      rowsLength: ga4Data.rows?.length || 0,
      firstRow: ga4Data.rows?.[0] || null
    })

    // Process and save data
    const rows = ga4Data.rows || []
    console.log(`🔍 Processing ${rows.length} rows for user ${user.id}, property ${connection.property_id}`)

    // Prepare all rows for batch upsert
    const payload = rows.map((row: any) => {
      const date = row.dimensionValues[0].value
      const activeUsers = parseInt(row.metricValues[0].value) || 0
      const sessions = parseInt(row.metricValues[1].value) || 0
      const conversions = parseInt(row.metricValues[2]?.value) || 0
      const totalRevenue = parseFloat(row.metricValues[3]?.value) || 0

      console.log(`🔍 Preparing: ${date} - users: ${activeUsers}, sessions: ${sessions}, conversions: ${conversions}, revenue: ${totalRevenue}`)

      return {
        user_id: user.id,
        property_id: connection.property_id,
        date: date,
        active_users: activeUsers,
        sessions: sessions,
        conversions: conversions,
        total_revenue: totalRevenue
      }
    })

    // Batch upsert using ADMIN client (bypasses RLS)
    const { error: upsertError } = await ADMIN
      .from('ga4_daily')
      .upsert(payload, {
        onConflict: 'user_id,property_id,date'
      })

    if (upsertError) {
      console.error('❌ Batch upsert error:', upsertError)
      return NextResponse.json({ 
        error: 'upsert_failed', 
        message: upsertError.message 
      }, { status: 500 })
    } else {
      console.log(`✅ Successfully upserted ${payload.length} rows`)
    }

    return NextResponse.json({ 
      success: true, 
      message: `Synced ${rows.length} data points` 
    })

  } catch (error: any) {
    console.error('Manual sync error:', error)
    return NextResponse.json({ 
      error: 'sync_failed', 
      message: error.message 
    }, { status: 500 })
  }
}