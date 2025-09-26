import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const body = await req.json()
    console.log('GA4 select request body:', body)
    
    const { propertyId, propertyDisplayName, accountDisplayName } = body

    if (!propertyId) {
      return NextResponse.json({ error: 'missing_propertyId' }, { status: 400 })
    }

    // First, delete any existing connection for this user
    await supabase
      .from('ga4_connections')
      .delete()
      .eq('user_id', user.id)

    // Then insert the new connection
    const payload = {
      user_id: user.id,
      property_id: String(propertyId),
      display_name: propertyDisplayName ?? null,
    }
    
    console.log('GA4 select payload:', payload)
    
    const { error } = await supabase
      .from('ga4_connections')
      .insert(payload)

    if (error) {
      console.error('GA4 select database error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('GA4 select error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
