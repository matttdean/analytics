import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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

  // If no session, redirect to login
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    if (req.nextUrl.pathname.startsWith('/dashboard') || 
        req.nextUrl.pathname.startsWith('/analytics') ||
        req.nextUrl.pathname.startsWith('/search-console') ||
        req.nextUrl.pathname.startsWith('/business-profile') ||
        req.nextUrl.pathname.startsWith('/performance') ||
        req.nextUrl.pathname.startsWith('/audience') ||
        req.nextUrl.pathname.startsWith('/goals') ||
        req.nextUrl.pathname.startsWith('/reports') ||
        req.nextUrl.pathname.startsWith('/alerts') ||
        req.nextUrl.pathname.startsWith('/settings') ||
        req.nextUrl.pathname.startsWith('/help')) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    return res
  }

  // If user is authenticated, check if they need onboarding
  if (session.user) {
    // Check if user has GA4 connection
    const { data: ga4Connection } = await supabase
      .from('ga4_connections')
      .select('property_id')
      .eq('user_id', session.user.id)
      .maybeSingle()

    // Only redirect to onboarding for dashboard page if no GA4 connection
    // Other pages can be accessed even without GA4 connection
    if (!ga4Connection?.property_id && req.nextUrl.pathname === '/dashboard') {
      return NextResponse.redirect(new URL('/onboarding', req.url))
    }
  }

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/analytics/:path*',
    '/search-console/:path*',
    '/business-profile/:path*',
    '/performance/:path*',
    '/audience/:path*',
    '/goals/:path*',
    '/reports/:path*',
    '/alerts/:path*',
    '/settings/:path*',
    '/help/:path*',
    '/onboarding/:path*'
  ],
}
