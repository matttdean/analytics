export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Connect the real location we found
    const locationData = {
      user_id: user.id,
      location_name: 'accounts/102070975441152489673/locations/2765560021277676673',
      label: 'Dean Design'
    }

    // Delete any existing connection
    await supabase
      .from('gbp_connections')
      .delete()
      .eq('user_id', user.id)

    // Insert the new connection
    const { data, error } = await supabase
      .from('gbp_connections')
      .insert(locationData)
      .select()

    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: 'db_error', 
        message: error.message 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Real location connected successfully',
      data: data[0],
      locationInfo: {
        locationId: '2765560021277676673',
        businessName: 'Dean Design',
        website: 'https://deandesign.co/',
        accountId: '102070975441152489673'
      }
    })
  } catch (e: any) {
    console.error('Connect real location error:', e)
    return NextResponse.json({ 
      error: e?.message || 'unknown_error',
      stack: e?.stack 
    }, { status: 500 })
  }
}

