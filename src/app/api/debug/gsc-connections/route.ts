import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Get user's Search Console connections
    const { data: gscConnections, error: gscError } = await supabase
      .from('gsc_connections')
      .select('*')
      .eq('user_id', user.id)

    if (gscError) {
      console.error('Error fetching GSC connections:', gscError)
      return NextResponse.json({ error: 'failed_to_fetch_connections' }, { status: 500 })
    }

    // Get user email for debugging
    const { data: userData } = await supabase
      .from('auth.users')
      .select('email')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      user: {
        id: user.id,
        email: userData?.email || 'unknown'
      },
      gscConnections: gscConnections || [],
      connectionCount: gscConnections?.length || 0,
      message: gscConnections?.length === 0 
        ? 'No Search Console connections found. This is why it falls back to deandesign.co'
        : 'Search Console connections found'
    })

  } catch (error: any) {
    console.error('Debug GSC connections error:', error)
    return NextResponse.json({ 
      error: 'debug_failed', 
      message: error.message 
    }, { status: 500 })
  }
}

