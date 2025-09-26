import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('🔍 GA4 Daily Check API called')
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Auth error in ga4-daily-check:', userError)
      return NextResponse.json({ error: 'auth_error', message: userError.message }, { status: 401 })
    }

    if (!user) {
      console.log('❌ No user found in ga4-daily-check API')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    // Check ga4_daily table for this user
    const { data: dailyData, error: dailyError } = await supabase
      .from('ga4_daily')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(10)

    if (dailyError) {
      console.error('❌ Error querying ga4_daily:', dailyError)
      return NextResponse.json({ 
        error: 'db_error', 
        message: dailyError.message,
        details: dailyError
      }, { status: 500 })
    }

    console.log('🔍 ga4_daily result:', dailyData)

    // Also check total count
    const { count: totalCount, error: countError } = await supabase
      .from('ga4_daily')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      daily_data: dailyData || [],
      total_count: totalCount || 0,
      sample_data: dailyData?.slice(0, 3) || [],
      has_data: (dailyData?.length || 0) > 0
    })

  } catch (e: any) {
    console.error('GA4 daily check endpoint error:', e)
    return NextResponse.json({
      error: 'internal_error',
      message: e?.message || 'Unknown error occurred',
      details: e?.toString()
    }, { status: 500 })
  }
}


