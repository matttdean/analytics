import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { propertyId, propertyDisplayName, accountDisplayName } = await req.json()

    if (!propertyId) {
      return NextResponse.json({ error: 'missing_propertyId' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { error } = await supabase
      .from('ga4_connections')
      .upsert({
        user_id: user.id,
        property_id: String(propertyId),
        property_display_name: propertyDisplayName ?? null,
        account_display_name: accountDisplayName ?? null,
        updated_at: now,
      }, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}
