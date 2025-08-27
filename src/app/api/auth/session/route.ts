import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function POST(req: Request) {
  const { access_token, refresh_token } = await req.json().catch(() => ({} as any))

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: 'missing tokens' }, { status: 400 })
  }

  // ⬅️ IMPORTANT: await cookies()
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 })
        },
      },
    }
  )

  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
