import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Supabase server client wired to middleware cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, path: '/', ...options })
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: '', path: '/', maxAge: 0, ...options })
        },
      },
    }
  )

  // Only gate protected paths
  const protectedPath =
    req.nextUrl.pathname.startsWith('/dashboard') ||
    req.nextUrl.pathname.startsWith('/api/data')

  if (!protectedPath) return res

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', req.nextUrl.pathname) // optional: send them back after login
    return NextResponse.redirect(url)
  }

  return res
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/data/:path*'],
}
