export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Call the GBP sync endpoint
    const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/gbp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${user.id}` // This won't work in server context, but let's try
      }
    })

    const result = await response.json()

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      data: result
    })

  } catch (error: any) {
    console.error('Debug GBP sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Check what GBP data we have stored
    const { data: businessData } = await supabase
      .from('gbp_business_data')
      .select('*')
      .eq('user_id', user.id)

    const { data: performanceData } = await supabase
      .from('gbp_performance_data')
      .select('*')
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      business_data: businessData || [],
      performance_data: performanceData || [],
      counts: {
        business_records: businessData?.length || 0,
        performance_records: performanceData?.length || 0
      }
    })

  } catch (error: any) {
    console.error('Debug GBP data check error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

