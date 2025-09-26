import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  try {
    console.log('=== ONBOARDING STATUS CHECK ===')
    
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Check GA4 connection
    const { data: ga4Conn } = await supabase
      .from('ga4_connections')
      .select('property_id, display_name')
      .eq('user_id', user.id)
      .maybeSingle()

    // Check GBP connection
    const { data: gbpConn } = await supabase
      .from('gbp_connections')
      .select('location_name, label')
      .eq('user_id', user.id)
      .maybeSingle()

    // Check Search Console connection
    const { data: scConn } = await supabase
      .from('search_console_connections')
      .select('site_url')
      .eq('user_id', user.id)
      .maybeSingle()

    // Check if onboarding is marked as complete
    const { data: onboardingStatus } = await supabase
      .from('user_onboarding')
      .select('completed_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const status = {
      user: {
        id: user.id,
        email: user.email
      },
      connections: {
        ga4: {
          connected: !!ga4Conn?.property_id,
          propertyId: ga4Conn?.property_id,
          propertyName: ga4Conn?.display_name
        },
        gbp: {
          connected: !!gbpConn?.location_name,
          accountId: gbpConn?.location_name?.split('/')[1], // Extract account ID from location_name
          locationId: gbpConn?.location_name?.split('/')[3] // Extract location ID from location_name
        },
        searchConsole: {
          connected: !!scConn?.site_url,
          siteUrl: scConn?.site_url
        }
      },
      onboarding: {
        completed: !!onboardingStatus?.completed_at,
        completedAt: onboardingStatus?.completed_at
      },
      progress: {
        totalSteps: 5,
        completedSteps: 0,
        requiredSteps: 3
      }
    }

    // Calculate progress
    if (status.connections.ga4.connected) status.progress.completedSteps++
    if (status.connections.gbp.connected) status.progress.completedSteps++
    if (status.connections.searchConsole.connected) status.progress.completedSteps++
    if (status.onboarding.completed) status.progress.completedSteps++

    // Only show onboarding for NEW users who haven't connected GA4
    // Existing users with GA4 connections should NOT be forced to onboarding
    const shouldShowOnboarding = !status.onboarding.completed && 
      !status.connections.ga4.connected && 
      status.progress.completedSteps === 0

    console.log('Onboarding status:', status)
    console.log('Should show onboarding:', shouldShowOnboarding)

    return NextResponse.json({
      ...status,
      shouldShowOnboarding,
      recommendations: getRecommendations(status)
    })

  } catch (error: any) {
    console.error('Onboarding status check error:', error)
    return NextResponse.json({ 
      success: false,
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}

function getRecommendations(status: any) {
  const recommendations = []

  if (!status.connections.ga4.connected) {
    recommendations.push({
      priority: 'high',
      type: 'ga4',
      message: 'Connect Google Analytics 4 to start tracking your website performance',
      action: 'Connect GA4 Property'
    })
  }

  if (!status.connections.gbp.connected) {
    recommendations.push({
      priority: 'medium',
      type: 'gbp',
      message: 'Connect Google Business Profile for local business insights',
      action: 'Connect Business Profile'
    })
  }

  if (!status.connections.searchConsole.connected) {
    recommendations.push({
      priority: 'medium',
      type: 'search-console',
      message: 'Connect Search Console to track SEO performance',
      action: 'Connect Search Console'
    })
  }

  if (!status.onboarding.completed && status.connections.ga4.connected) {
    recommendations.push({
      priority: 'high',
      type: 'onboarding',
      message: 'Complete onboarding to set up your first goals and dashboard',
      action: 'Complete Onboarding'
    })
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 }
    return priorityOrder[b.priority] - priorityOrder[a.priority]
  })
}
