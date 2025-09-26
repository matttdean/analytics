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
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ga4Conn?.property_id) {
      return NextResponse.json({ error: 'no_ga4_connection' }, { status: 400 })
    }

    const originalPropertyId = ga4Conn.property_id
    const formattedPropertyId = originalPropertyId.startsWith('properties/') 
      ? originalPropertyId 
      : `properties/${originalPropertyId}`

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      property: {
        original: originalPropertyId,
        formatted: formattedPropertyId,
        displayName: ga4Conn.display_name
      },
      apiUrl: `https://analyticsdata.googleapis.com/v1beta/${formattedPropertyId}:runReport`
    })

  } catch (error: any) {
    console.error('Property format debug error:', error)
    return NextResponse.json({ 
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}

