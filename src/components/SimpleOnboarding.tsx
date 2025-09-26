'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { CheckCircle, AlertCircle, ExternalLink, BarChart3, Globe } from 'lucide-react'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`)
    ;(error as any).status = response.status
    ;(error as any).data = data
    throw error
  }
  
  return data
}

interface Site {
  siteUrl: string
  permissionLevel: string
  available: boolean
}

interface GA4Property {
  propertyId: string
  propertyDisplayName: string
  accountDisplayName: string
}

export default function SimpleOnboarding() {
  const [step, setStep] = useState(1)
  const [selectedGSCSite, setSelectedGSCSite] = useState<string>('')
  const [selectedGA4Property, setSelectedGA4Property] = useState<string>('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isGoogleConnected, setIsGoogleConnected] = useState(false)

  // Check if user is already connected
  const { data: onboardingStatus, error: onboardingError } = useSWR('/api/onboarding/status', fetcher)

  // Fetch available sites and properties (only after Google is connected)
  const { data: gscSites, error: gscError } = useSWR(isGoogleConnected ? '/api/google/gsc/sites' : null, fetcher)
  const { data: ga4Properties, error: ga4Error } = useSWR(isGoogleConnected ? '/api/google/ga4/properties' : null, fetcher)

  // Debug logging
  console.log('Onboarding Debug:', {
    isGoogleConnected,
    step,
    gscSites,
    gscError,
    ga4Properties,
    ga4Error,
    onboardingStatus,
    onboardingError
  })

  useEffect(() => {
    if (onboardingStatus?.isComplete) {
      // Redirect to dashboard if already set up
      window.location.href = '/dashboard'
    }
  }, [onboardingStatus])

  // Check if Google is connected
  useEffect(() => {
    const checkGoogleConnection = async () => {
      try {
        const response = await fetch('/api/google/oauth/status')
        const data = await response.json()
        if (data.connected) {
          setIsGoogleConnected(true)
          if (step === 1) {
            setStep(2) // Move to step 2 (GA4) if Google is already connected
          }
        } else {
          setIsGoogleConnected(false)
        }
      } catch (error) {
        console.error('Error checking Google connection:', error)
        setIsGoogleConnected(false)
      }
    }
    
    checkGoogleConnection()
  }, [step])

  // Also check on component mount
  useEffect(() => {
    const checkGoogleConnection = async () => {
      try {
        const response = await fetch('/api/google/oauth/status')
        const data = await response.json()
        if (data.connected) {
          setIsGoogleConnected(true)
        }
      } catch (error) {
        console.error('Error checking Google connection:', error)
      }
    }
    
    checkGoogleConnection()
  }, [])


  const handleConnectGA4 = async () => {
    if (!selectedGA4Property) return
    
    setIsConnecting(true)
    try {
      const response = await fetch('/api/google/ga4/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId: selectedGA4Property })
      })
      
      if (response.ok) {
        setStep(3) // Move to Search Console step
      }
    } catch (error) {
      console.error('Failed to connect GA4 property:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleConnectGSC = async () => {
    if (!selectedGSCSite) return
    
    setIsConnecting(true)
    try {
      const response = await fetch('/api/google/gsc/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedGSCSite })
      })
      
      if (response.ok) {
        // Complete onboarding
        await fetch('/api/setup/complete', { method: 'POST' })
        window.location.href = '/dashboard'
      }
    } catch (error) {
      console.error('Failed to connect GSC site:', error)
    } finally {
      setIsConnecting(false)
    }
  }

  // Handle authentication errors
  if (onboardingError?.status === 401) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">
            You need to be logged in to access the onboarding process. Please sign in first.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </a>
        </div>
      </div>
    )
  }

  // Show loading state while checking authentication
  if (!onboardingStatus && !onboardingError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    )
  }

  if (onboardingStatus?.isComplete) {
    return null // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Your Analytics Dashboard</h1>
            <p className="text-gray-600">Let's connect your Google services to get started</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <div className={`w-16 h-1 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <div className={`w-16 h-1 ${step >= 3 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > 3 ? <CheckCircle className="w-5 h-5" /> : '3'}
              </div>
            </div>
          </div>

          {/* Step 1: Connect Google Account */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Your Google Account</h2>
                <p className="text-gray-600">First, we need to connect your Google account to access your analytics data</p>
              </div>

              <div className="text-center py-8">
                <p className="text-gray-600 mb-6">
                  Click the button below to connect your Google account. This will allow us to access your Search Console and Analytics data.
                </p>
                
                <a
                  href="/api/google/oauth/start"
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <div className="w-6 h-6">
                    <svg viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  </div>
                  <span className="text-gray-700 font-medium">Continue with Google</span>
                </a>
              </div>
            </div>
          )}

          {/* Step 2: Google Analytics */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Google Analytics</h2>
                <p className="text-gray-600">Choose which property you want to track analytics for</p>
              </div>

              {ga4Error ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Properties</h3>
                  <p className="text-gray-600 mb-4">
                    {ga4Error.message || 'Failed to load Google Analytics properties. Please try again.'}
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : ga4Properties?.items?.length > 0 ? (
                <div className="space-y-3">
                  {ga4Properties.items.map((property: GA4Property) => (
                    <label
                      key={property.propertyId}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedGA4Property === property.propertyId
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ga4-property"
                        value={property.propertyId}
                        checked={selectedGA4Property === property.propertyId}
                        onChange={(e) => setSelectedGA4Property(e.target.value)}
                        className="h-4 w-4 text-green-600 border-gray-300 focus:ring-green-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">{property.propertyDisplayName}</div>
                        <div className="text-sm text-gray-500">
                          Account: {property.accountDisplayName}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Analytics Properties Found</h3>
                  <p className="text-gray-600 mb-4">
                    You don't have any Google Analytics 4 properties set up yet.
                  </p>
                  <a
                    href="https://analytics.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to Google Analytics
                  </a>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConnectGA4}
                  disabled={!selectedGA4Property || isConnecting}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting ? 'Connecting...' : 'Continue'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Search Console */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center">
                <Globe className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Connect Search Console</h2>
                <p className="text-gray-600">Choose which website you want to track search performance for</p>
              </div>

              {gscError ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Sites</h3>
                  <p className="text-gray-600 mb-4">
                    {gscError.message || 'Failed to load Search Console sites. Please try again.'}
                  </p>
                  {gscError.status === 401 && (
                    <p className="text-sm text-red-600 mb-4">
                      You may need to reconnect your Google account or sign in again.
                    </p>
                  )}
                  <button
                    onClick={() => window.location.reload()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : gscSites?.sites?.length > 0 ? (
                <div className="space-y-3">
                  {gscSites.sites.map((site: Site) => (
                    <label
                      key={site.siteUrl}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedGSCSite === site.siteUrl
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="gsc-site"
                        value={site.siteUrl}
                        checked={selectedGSCSite === site.siteUrl}
                        onChange={(e) => setSelectedGSCSite(e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="font-medium text-gray-900">{site.siteUrl}</div>
                        <div className="text-sm text-gray-500 capitalize">
                          Permission: {site.permissionLevel}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Search Console Sites Found</h3>
                  <p className="text-gray-600 mb-4">
                    You don't have any websites verified in Google Search Console yet.
                  </p>
                  <a
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Go to Search Console
                  </a>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleConnectGSC}
                  disabled={!selectedGSCSite || isConnecting}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isConnecting ? 'Connecting...' : 'Complete Setup'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
