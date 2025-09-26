import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('=== GSC TEST ENDPOINT CALLED ===')
    
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    console.log('Auth check:', { 
      hasUser: !!user, 
      userId: user?.id, 
      userError: userError?.message 
    })
    
    if (!user) {
      return NextResponse.json({ 
        error: 'not_authenticated',
        message: 'User not authenticated'
      }, { status: 401 })
    }

    // Test reading tokens
    console.log('Testing token reading...')
    const { readToken } = await import('@/lib/google')
    const { access, refresh, expiresAt } = await readToken(supabase, user.id)
    
    console.log('Token read result:', {
      hasAccess: !!access,
      hasRefresh: !!refresh,
      expiresAt: expiresAt,
      isExpired: expiresAt ? new Date(expiresAt) < new Date() : null
    })

    if (!access) {
      return NextResponse.json({
        error: 'no_access_token',
        message: 'No Google access token found'
      }, { status: 400 })
    }

    // Test Search Console API call
    console.log('Testing Search Console API call...')
    const accessToken = access as string
    
    try {
      const resp = await fetch(
        'https://searchconsole.googleapis.com/webmasters/v3/sites',
        {
          headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
          },
        }
      )
      
      console.log('Search Console API response:', {
        status: resp.status,
        statusText: resp.statusText,
        ok: resp.ok
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        console.log('Search Console API error response:', errorText)
        return NextResponse.json({
          error: 'search_console_api_error',
          status: resp.status,
          message: errorText
        }, { status: resp.status })
      }

      const siteData = await resp.json()
      console.log('Search Console API success:', siteData)

      return NextResponse.json({
        success: true,
        sites: siteData.siteEntry || [],
        message: 'Search Console API call successful'
      })

    } catch (apiError: any) {
      console.error('Search Console API call failed:', apiError)
      return NextResponse.json({
        error: 'api_call_failed',
        message: apiError.message,
        stack: apiError.stack
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('GSC test endpoint error:', error)
    return NextResponse.json({
      error: 'internal_error',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}


