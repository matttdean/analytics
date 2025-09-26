import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('=== TESTING ONBOARDING LOGIC ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id, user.email)

    // Check GA4 connection
    const { data: ga4Conn } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    // Check if onboarding is marked as complete
    const { data: onboardingStatus } = await supabase
      .from('user_onboarding')
      .select('completed_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const testResults = {
      user: {
        id: user.id,
        email: user.email
      },
      connections: {
        ga4: {
          connected: !!ga4Conn?.property_id,
          propertyId: ga4Conn?.property_id,
          propertyName: ga4Conn?.display_name
        }
      },
      onboarding: {
        completed: !!onboardingStatus?.completed_at,
        completedAt: onboardingStatus?.completed_at
      },
      logic: {
        hasGa4Connection: !!ga4Conn?.property_id,
        hasCompletedOnboarding: !!onboardingStatus?.completed_at,
        shouldShowOnboarding: !onboardingStatus?.completed_at && !ga4Conn?.property_id,
        explanation: ''
      }
    }

    // Explain the logic
    if (testResults.logic.hasGa4Connection && testResults.logic.hasCompletedOnboarding) {
      testResults.logic.explanation = 'User has GA4 connected AND completed onboarding - NO onboarding needed'
    } else if (testResults.logic.hasGa4Connection && !testResults.logic.hasCompletedOnboarding) {
      testResults.logic.explanation = 'User has GA4 connected but NOT completed onboarding - Show onboarding button in sidebar'
    } else if (!testResults.logic.hasGa4Connection && !testResults.logic.hasCompletedOnboarding) {
      testResults.logic.explanation = 'User has NO GA4 connection AND NOT completed onboarding - Force redirect to onboarding'
    } else {
      testResults.logic.explanation = 'Edge case - should not happen'
    }

    console.log('Test results:', testResults)
    
    return NextResponse.json({
      success: true,
      message: 'Onboarding logic test completed',
      results: testResults
    })

  } catch (error: any) {
    console.error('Onboarding logic test error:', error)
    return NextResponse.json({ 
      success: false,
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}
