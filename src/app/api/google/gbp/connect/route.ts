export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { locationName, locationTitle } = await req.json()
    if (!locationName) return NextResponse.json({ error: 'missing_locationName' }, { status: 400 })

    // Upsert connection
    await supabase.from('gbp_connections')
      .delete().eq('user_id', user.id)

    const { error } = await supabase.from('gbp_connections').insert({
      user_id: user.id,
      location_name: locationName, // e.g. "locations/2765560021277676673"
      label: locationTitle ?? null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('GBP connect error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}