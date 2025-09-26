'use client'

import { useEffect, useState } from 'react'
import SimpleOnboarding from '../../../components/SimpleOnboarding'
import VisitorsOverview from '../../../components/dashboard/VisitorsOverview'
import ActiveNow from '../../../components/dashboard/ActiveNow'
import TopPages from '../../../components/dashboard/TopPages'
import TopQueries from '../../../components/dashboard/SimpleTopQueries'
import BusinessProfile from '../../../components/dashboard/BusinessProfile'

export default function Dashboard() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const response = await fetch('/api/onboarding/status')
        const data = await response.json()
        
        if (data.shouldShowOnboarding) {
          setShowOnboarding(true)
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
        setShowOnboarding(true) // Show onboarding on error
      } finally {
        setIsLoading(false)
      }
    }

    checkOnboardingStatus()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (showOnboarding) {
    return <SimpleOnboarding />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Welcome to your analytics dashboard</p>
      </div>

      {/* Active Users */}
      <ActiveNow />

      {/* Visitors Overview */}
      <VisitorsOverview />

      {/* Top Pages */}
      <TopPages />

      {/* Top Search Queries */}
      <TopQueries />

      {/* Business Profile */}
      <BusinessProfile />
    </div>
  )
}