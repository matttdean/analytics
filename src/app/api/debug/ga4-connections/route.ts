import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('=== GA4 CONNECTIONS DEBUG ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id, user.email)

    // Get all GA4 connections
    const { data: connections, error: connError } = await supabase
      .from('ga4_connections')
      .select('user_id, property_id, display_name, created_at')
      .order('created_at', { ascending: false })

    if (connError) {
      console.error('Connections query error:', connError)
      return NextResponse.json({ 
        success: false, 
        error: 'connections_query_failed',
        details: connError.message
      })
    }

    console.log('Found connections:', connections?.length || 0)

    // Get user emails for the connections
    const userIds = connections?.map(c => c.user_id) || []
    let userEmails: Record<string, string> = {}
    
    if (userIds.length > 0) {
      const { data: users, error: userError } = await supabase
        .from('auth.users')
        .select('id, email')
        .in('id', userIds)
      
      if (!userError && users) {
        userEmails = users.reduce((acc, u) => {
          acc[u.id] = u.email || 'unknown'
          return acc
        }, {} as Record<string, string>)
      }
    }

    // Get current user's connection
    const { data: currentUserConn } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const result = {
      currentUser: {
        id: user.id,
        email: user.email,
        hasConnection: !!currentUserConn,
        connection: currentUserConn
      },
      allConnections: connections?.map(conn => ({
        ...conn,
        userEmail: userEmails[conn.user_id] || 'unknown'
      })) || [],
      totalConnections: connections?.length || 0
    }

    console.log('Debug result:', result)
    return NextResponse.json(result)
    
  } catch (e: any) {
    console.error('GA4 connections debug error:', e)
    return NextResponse.json({ 
      success: false,
      error: e?.message || 'unknown_error',
      details: e.toString()
    }, { status: 500 })
  }
}
