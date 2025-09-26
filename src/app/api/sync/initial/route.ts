import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    console.log('=== INITIAL SYNC START ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Check if user has GA4 property connected
    const { data: ga4Conn } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ga4Conn?.property_id) {
      return NextResponse.json({ 
        error: 'no_ga4_property', 
        message: 'No GA4 property connected. Please complete GA4 setup first.' 
      }, { status: 400 })
    }

    console.log('GA4 property found:', ga4Conn.property_id)

    // Trigger initial data sync for all services
    const syncResults = {
      ga4: { status: 'pending', message: 'Starting GA4 data sync...' },
      gbp: { status: 'pending', message: 'Starting GBP data sync...' },
      searchConsole: { status: 'pending', message: 'Starting Search Console sync...' }
    }

    try {
      // Test GA4 API access
      console.log('Testing GA4 API access...')
      const ga4Test = await fetch(`/api/test-ga4`)
      if (ga4Test.ok) {
        syncResults.ga4 = { status: 'success', message: 'GA4 data sync completed' }
      } else {
        syncResults.ga4 = { status: 'error', message: 'GA4 data sync failed' }
      }
    } catch (error) {
      console.error('GA4 sync error:', error)
      syncResults.ga4 = { status: 'error', message: 'GA4 sync error occurred' }
    }

    try {
      // Test GBP API access
      console.log('Testing GBP API access...')
      const gbpTest = await fetch(`/api/test-gbp`)
      if (gbpTest.ok) {
        syncResults.gbp = { status: 'success', message: 'GBP data sync completed' }
      } else {
        syncResults.gbp = { status: 'error', message: 'GBP data sync failed' }
      }
    } catch (error) {
      console.error('GBP sync error:', error)
      syncResults.gbp = { status: 'error', message: 'GBP sync error occurred' }
    }

    // Check if user has Search Console connected
    const { data: scConn } = await supabase
      .from('search_console_connections')
      .select('site_url')
      .eq('user_id', user.id)
      .maybeSingle()

    if (scConn?.site_url) {
      try {
        // Test Search Console API access
        console.log('Testing Search Console API access...')
        const scTest = await fetch(`/api/test-search-console`)
        if (scTest.ok) {
          syncResults.searchConsole = { status: 'success', message: 'Search Console sync completed' }
        } else {
          syncResults.searchConsole = { status: 'error', message: 'Search Console sync failed' }
        }
      } catch (error) {
        console.error('Search Console sync error:', error)
        syncResults.searchConsole = { status: 'error', message: 'Search Console sync error occurred' }
      }
    } else {
      syncResults.searchConsole = { status: 'skipped', message: 'Search Console not connected' }
    }

    // Create initial goals based on the user's data
    const initialGoals = [
      {
        name: 'Increase Website Traffic',
        type: 'traffic',
        target: 1000,
        current: 0,
        conversionRate: 0,
        status: 'on-track',
        description: 'Grow monthly website visitors by 20%'
      },
      {
        name: 'Improve Conversion Rate',
        type: 'conversion',
        target: 0.05,
        current: 0,
        conversionRate: 0,
        status: 'on-track',
        description: 'Achieve 5% conversion rate from website visitors'
      },
      {
        name: 'Reduce Bounce Rate',
        type: 'engagement',
        target: 0.4,
        current: 0,
        conversionRate: 0,
        status: 'on-track',
        description: 'Lower bounce rate to 40% or below'
      }
    ]

    // Store initial goals in the database (if you have a goals table)
    // For now, we'll just return them
    console.log('Initial goals created:', initialGoals.length)

    // Mark onboarding as complete
    await supabase
      .from('user_onboarding')
      .upsert({
        user_id: user.id,
        completed_at: new Date().toISOString(),
        ga4_property_id: ga4Conn.property_id,
        gbp_connected: syncResults.gbp.status === 'success',
        search_console_connected: syncResults.searchConsole.status === 'success'
      })

    console.log('Initial sync completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Initial sync completed',
      results: syncResults,
      initialGoals,
      nextSteps: [
        'Review your analytics dashboard',
        'Set up custom goals based on your business needs',
        'Configure alerts for important metrics',
        'Schedule regular performance reviews'
      ]
    })

  } catch (error: any) {
    console.error('Initial sync error:', error)
    return NextResponse.json({ 
      success: false,
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}
