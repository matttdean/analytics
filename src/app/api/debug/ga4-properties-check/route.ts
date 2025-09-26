import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('🔍 GA4 Properties Check API called')
    const supabase = await createWritableClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('Auth error in ga4-properties-check:', userError)
      return NextResponse.json({ error: 'auth_error', message: userError.message }, { status: 401 })
    }

    if (!user) {
      console.log('❌ No user found in ga4-properties-check API')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('✅ User authenticated:', user.id)

    // Call the actual GA4 properties API
    const response = await fetch(`${req.url.split('/api/debug')[0]}/api/google/ga4/properties`, {
      headers: {
        'Cookie': req.headers.get('Cookie') || '',
        'User-Agent': req.headers.get('User-Agent') || '',
      }
    })

    const responseText = await response.text()
    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch {
      responseData = { raw_response: responseText }
    }

    console.log('🔍 GA4 Properties API response:', {
      status: response.status,
      data: responseData
    })

    return NextResponse.json({
      user_id: user.id,
      user_email: user.email,
      ga4_properties_api_status: response.status,
      ga4_properties_api_response: responseData,
      has_items: responseData?.items?.length > 0,
      items_count: responseData?.items?.length || 0,
      has_properties: responseData?.properties?.length > 0,
      properties_count: responseData?.properties?.length || 0
    })

  } catch (e: any) {
    console.error('GA4 properties check endpoint error:', e)
    return NextResponse.json({
      error: 'internal_error',
      message: e?.message || 'Unknown error occurred',
      details: e?.toString()
    }, { status: 500 })
  }
}


