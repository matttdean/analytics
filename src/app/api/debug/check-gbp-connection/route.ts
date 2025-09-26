export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Check what's stored in gbp_connections
    const { data: conn, error } = await supabase
      .from('gbp_connections')
      .select('location_name, label')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: 'db_error', message: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      connection: conn,
      hasConnection: !!conn?.location_name
    })

  } catch (e: any) {
    console.error('Check GBP connection error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}

