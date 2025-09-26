import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Get user's GA4 property
    const { data: ga4Conn } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ga4Conn?.property_id) {
      return NextResponse.json({ error: 'no_ga4_connection' }, { status: 400 })
    }

    // Test with regular client (should respect RLS)
    const { data: regularData, error: regularError } = await supabase
      .from('ga4_daily')
      .select('*')
      .eq('user_id', user.id)
      .limit(5)

    // Test with service role client (bypasses RLS)
    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: serviceData, error: serviceError } = await serviceClient
      .from('ga4_daily')
      .select('*')
      .eq('user_id', user.id)
      .limit(5)

    // Test insert with regular client
    const testRow = {
      user_id: user.id,
      property_id: ga4Conn.property_id,
      date: '2025-01-01',
      sessions: 0,
      active_users: 0,
      conversions: 0,
      total_revenue: 0
    }

    const { data: insertData, error: insertError } = await supabase
      .from('ga4_daily')
      .insert(testRow)
      .select()

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      ga4Connection: ga4Conn,
      rlsTests: {
        regularClient: {
          data: regularData,
          error: regularError,
          count: regularData?.length || 0
        },
        serviceClient: {
          data: serviceData,
          error: serviceError,
          count: serviceData?.length || 0
        },
        insertTest: {
          data: insertData,
          error: insertError,
          testRow
        }
      }
    })

  } catch (error: any) {
    console.error('GA4 daily RLS debug error:', error)
    return NextResponse.json({ 
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}

