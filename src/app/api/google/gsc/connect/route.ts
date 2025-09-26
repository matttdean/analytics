import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { siteUrl } = await req.json()

    if (!siteUrl) {
      return NextResponse.json({ error: 'site_url_required' }, { status: 400 })
    }

    // Check if connection already exists
    const { data: existingConnection } = await supabase
      .from('gsc_connections')
      .select('id')
      .eq('user_id', user.id)
      .eq('site_url', siteUrl)
      .maybeSingle()

    if (existingConnection) {
      return NextResponse.json({ error: 'connection_already_exists' }, { status: 400 })
    }

    // Create new connection
    const { data: connection, error } = await supabase
      .from('gsc_connections')
      .insert({
        user_id: user.id,
        site_url: siteUrl,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating GSC connection:', error)
      return NextResponse.json({ error: 'failed_to_create_connection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Search Console site connected successfully',
      connection
    })
  } catch (error: any) {
    console.error('GSC connect endpoint error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to connect Search Console site'
    }, { status: 500 })
  }
} 