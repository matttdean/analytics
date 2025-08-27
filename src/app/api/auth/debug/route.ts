// src/app/api/auth/debug/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  const jar = await cookies()
  const cookieNames = jar.getAll().map(c => c.name).sort()
  const supabase = await createWritableClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  return NextResponse.json({
    cookieNames,
    user: user ? { id: user.id, email: user.email } : null,
    authError: error?.message || null,
  })
}
