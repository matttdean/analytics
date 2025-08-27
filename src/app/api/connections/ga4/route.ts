import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'


export async function POST(req: Request) {
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
const { propertyId, displayName } = await req.json()
const { error } = await supabase.from('ga4_connections').insert({ user_id: user.id, property_id: propertyId, display_name: displayName ?? null })
if (error) return NextResponse.json({ error: error.message }, { status: 400 })
return NextResponse.json({ ok: true })
}