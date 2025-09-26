import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    console.log('=== DIRECT GSC API TEST ===')
    
    // Test with a dummy token to see what error we get
    const dummyToken = 'dummy_token_for_testing'
    
    try {
      const resp = await fetch(
        'https://searchconsole.googleapis.com/webmasters/v3/sites',
        {
          headers: {
            authorization: `Bearer ${dummyToken}`,
            'content-type': 'application/json',
          },
        }
      )
      
      console.log('Direct GSC API test response:', {
        status: resp.status,
        statusText: resp.statusText,
        ok: resp.ok
      })

      const responseText = await resp.text()
      console.log('Response body:', responseText)

      return NextResponse.json({
        test: 'direct_gsc_api',
        status: resp.status,
        statusText: resp.statusText,
        response: responseText.substring(0, 500) // Limit response size
      })

    } catch (apiError: any) {
      console.error('Direct GSC API test failed:', apiError)
      return NextResponse.json({
        test: 'direct_gsc_api',
        error: 'api_call_failed',
        message: apiError.message,
        stack: apiError.stack
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Direct GSC test endpoint error:', error)
    return NextResponse.json({
      test: 'direct_gsc_api',
      error: 'internal_error',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}


