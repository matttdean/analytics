import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('🔍 GA4 Connections Check API called')
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Auth error in ga4-connections-check:', userError)
      return NextResponse.json({ error: 'auth_error', message: userError.message }, { status: 401 })
    }

    if (!user) {
      console.log('❌ No user found in ga4-connections-check API')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    // Check ga4_connections table
    const { data: connections, error: connError } = await supabase
      .from('ga4_connections')
      .select('*')
      .eq('user_id', user.id)

    if (connError) {
      console.error('❌ Error querying ga4_connections:', connError)
      return NextResponse.json({ 
        error: 'db_error', 
        message: connError.message,
        details: connError
      }, { status: 500 })
    }

    console.log('🔍 ga4_connections result:', connections)

    // Also check if there are any connections at all
    const { data: allConnections, error: allConnError } = await supabase
      .from('ga4_connections')
      .select('user_id, property_id, property_name')
      .limit(10)

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      user_connections: connections || [],
      total_connections_count: connections?.length || 0,
      sample_all_connections: allConnections || [],
      has_property_id: connections?.some(c => c.property_id) || false,
      first_connection: connections?.[0] || null
    })

  } catch (e: any) {
    console.error('GA4 connections check endpoint error:', e)
    return NextResponse.json({
      error: 'internal_error',
      message: e?.message || 'Unknown error occurred',
      details: e?.toString()
    }, { status: 500 })
  }
}


