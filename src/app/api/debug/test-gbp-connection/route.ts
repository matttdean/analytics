export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { locationName, locationTitle } = await req.json() as {
      locationName?: string
      locationTitle?: string
    }

    if (!locationName) {
      return NextResponse.json({ error: 'missing_locationName' }, { status: 400 })
    }

    // First delete any existing connection, then insert new one
    await supabase
      .from('gbp_connections')
      .delete()
      .eq('user_id', user.id)

    const { data, error } = await supabase
      .from('gbp_connections')
      .insert({
        user_id: user.id,
        location_name: locationName,
        label: locationTitle || 'Test Location'
      })
      .select()

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        details: error
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Test GBP connection created',
      data
    })

  } catch (error: any) {
    console.error('Test GBP connection error:', error)
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

    // Check existing GBP connections
    const { data, error } = await supabase
      .from('gbp_connections')
      .select('*')
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      })
    }

    return NextResponse.json({
      success: true,
      connections: data || []
    })

  } catch (error: any) {
    console.error('Get GBP connections error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
