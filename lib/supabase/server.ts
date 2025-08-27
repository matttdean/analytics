import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function createClient() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return jar.get(name)?.value },
        set(_n: string, _v: string, _o: CookieOptions) {},
        remove(_n: string, _o: CookieOptions) {},
      },
    }
  )
}

export async function createWritableClient() {
  const jar = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return jar.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          jar.set({ name, value, path: '/', ...options })
        },
        remove(name: string, options: CookieOptions) {
          jar.set({ name, value: '', path: '/', maxAge: 0, ...options })
        },
      },
    }
  )
}
