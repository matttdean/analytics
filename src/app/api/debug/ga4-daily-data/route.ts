import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

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
      .select('property_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ga4Conn?.property_id) {
      return NextResponse.json({ error: 'no_ga4_connection' }, { status: 400 })
    }

    // Check what data exists in ga4_daily table
    const { data: ga4DailyData, error: ga4DailyError } = await supabase
      .from('ga4_daily')
      .select('*')
      .eq('property_id', ga4Conn.property_id)
      .order('date', { ascending: false })
      .limit(10)

    // Also check all ga4_daily data (for debugging)
    const { data: allGa4DailyData, error: allGa4DailyError } = await supabase
      .from('ga4_daily')
      .select('property_id, date, active_users')
      .order('date', { ascending: false })
      .limit(20)

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      ga4Connection: ga4Conn,
      ga4DailyData: {
        data: ga4DailyData,
        error: ga4DailyError,
        count: ga4DailyData?.length || 0
      },
      allGa4DailyData: {
        data: allGa4DailyData,
        error: allGa4DailyError,
        count: allGa4DailyData?.length || 0
      }
    })

  } catch (error: any) {
    console.error('GA4 daily data debug error:', error)
    return NextResponse.json({ 
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}

