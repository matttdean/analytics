export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Create a test location connection with a fake location ID
    const testLocationName = 'accounts/102070975441152489673/locations/test-location-123'
    const testLocationTitle = 'Test Business Location'

    // First delete any existing connection, then insert new one
    await supabase
      .from('gbp_connections')
      .delete()
      .eq('user_id', user.id)

    const { data, error } = await supabase
      .from('gbp_connections')
      .insert({
        user_id: user.id,
        location_name: testLocationName,
        label: testLocationTitle
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
      message: 'Test location created',
      data,
      note: 'This is a fake location for testing. You need to set up a real Google Business Profile location to get actual data.'
    })

  } catch (error: any) {
    console.error('Create test location error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
