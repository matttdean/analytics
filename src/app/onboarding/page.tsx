'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Chrome, BarChart3, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import GA4PropertySelector from '../../components/GA4PropertySelector'
import AuthGuard from '../../components/AuthGuard'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  status: 'pending' | 'in-progress' | 'completed' | 'error'
  required: boolean
}

function OnboardingPageContent() {
  const router = useRouter()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Check onboarding status
  const { data: onboardingStatus, mutate: refreshStatus } = useSWR('/api/onboarding/status', fetcher, {
    revalidateOnFocus: true
  })

  // Check GA4 connections
  const { data: ga4Connections, mutate: refreshConnections } = useSWR('/api/debug/ga4-connections', fetcher, {
    revalidateOnFocus: true
  })

  // Define onboarding steps
  const [onboardingSteps, setOnboardingSteps] = useState<OnboardingStep[]>([
    {
      id: 'google-oauth',
      title: 'Connect Google Account',
      description: 'Sign in with your Google account to access analytics and business data',
      icon: <Chrome className="h-6 w-6" />,
      status: 'pending',
      required: true
    },
    {
      id: 'ga4-property',
      title: 'Select Google Analytics Property',
      description: 'Choose which website or app to track with Google Analytics 4',
      icon: <BarChart3 className="h-6 w-6" />,
      status: 'pending',
      required: true
    }
  ])

  // Check if user just returned from OAuth
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.has('code') || urlParams.has('oauth_success')) {
      console.log('Detected OAuth return - clearing URL and going to step 2')
      // Clear the URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
      // Go to step 2
      setCurrentStepIndex(1)
      // Refresh the data
      refreshConnections()
      refreshStatus()
    }
  }, [])

  // Update step statuses
  useEffect(() => {
    if (onboardingStatus && ga4Connections) {
      console.log('Updating step statuses:', { onboardingStatus, ga4Connections })
      
      const newSteps = [...onboardingSteps]
      
      // Step 1: Google OAuth - completed if we have any connections
      if (ga4Connections.currentUser?.hasConnection) {
        console.log('Step 1 completed - Google OAuth connected')
        newSteps[0].status = 'completed'
        newSteps[1].status = 'in-progress'
      }
      
      // Step 2: GA4 Property - completed if we have a property selected
      if (ga4Connections.currentUser?.connection?.property_id) {
        console.log('Step 2 completed - GA4 property selected')
        newSteps[1].status = 'completed'
        
        // Auto-redirect to dashboard after a short delay
        setTimeout(() => {
          console.log('Redirecting to dashboard')
          router.push('/dashboard')
        }, 2000)
      }
      
      // Update the steps
      setOnboardingSteps(newSteps)
    }
  }, [onboardingStatus, ga4Connections])

  const handleStepAction = async (step: OnboardingStep) => {
    setIsLoading(true)
    
    try {
      switch (step.id) {
        case 'google-oauth':
          if (step.status === 'pending') {
            console.log('Starting Google OAuth flow')
            window.location.href = '/api/google/oauth/start'
          }
          break
          
        case 'ga4-property':
          if (step.status === 'pending') {
            // This step will be handled by the GA4PropertySelector component
            // No action needed here
          }
          break
      }
    } catch (error) {
      console.error('Step action error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePropertySelected = async () => {
    console.log('Property selected - refreshing data')
    // Refresh connections to update status
    await refreshConnections()
    await refreshStatus()
    
    // The useEffect will automatically redirect to dashboard
  }

  const goToNextStep = () => {
    if (currentStepIndex < onboardingSteps.length - 1) {
      console.log('Manually advancing to next step')
      setCurrentStepIndex(currentStepIndex + 1)
    }
  }

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      console.log('Going to previous step')
      setCurrentStepIndex(currentStepIndex - 1)
    }
  }

  // Show current onboarding step only
  const currentStep = onboardingSteps[currentStepIndex]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Welcome to Your Analytics Dashboard</h1>
              <p className="text-gray-600 mt-1">Let's get you set up in just a few steps</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Setting up your account</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStepIndex + 1} of {onboardingSteps.length}
            </span>
            <span className="text-sm text-gray-500">
              {onboardingSteps.filter(s => s.status === 'completed').length} of {onboardingSteps.length} completed
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ 
                width: `${(onboardingSteps.filter(s => s.status === 'completed').length / onboardingSteps.length) * 100}%` 
              }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Steps List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Setup Steps</h2>
              <div className="space-y-3">
                {onboardingSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      index === currentStepIndex 
                        ? 'bg-blue-50 border border-blue-200' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setCurrentStepIndex(index)}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      step.status === 'completed' ? 'bg-green-100 text-green-600' :
                      step.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                      step.status === 'error' ? 'bg-red-100 text-red-600' :
                      'bg-gray-100 text-gray-400'
                    }`}>
                      {step.status === 'completed' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : step.status === 'error' ? (
                        <span className="text-xs text-red-600">!</span>
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{step.title}</div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                    {step.required && (
                      <span className="text-xs text-red-500 font-medium">Required</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Current Step Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  currentStep.status === 'completed' ? 'bg-green-100 text-green-600' :
                  currentStep.status === 'in-progress' ? 'bg-blue-100 text-blue-600' :
                  currentStep.status === 'error' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {currentStep.status === 'completed' ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    currentStep.icon
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {currentStep.title}
                  </h2>
                  <p className="text-gray-600 mt-1">
                    {currentStep.description}
                  </p>
                </div>
              </div>

              {/* Step-specific content */}
              <div className="mb-8">
                {currentStep.id === 'google-oauth' && (
                  <div className="text-center">
                    {currentStep.status === 'completed' ? (
                      <div className="space-y-4">
                        <div className="text-green-600">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-lg font-medium">Google Account Connected!</p>
                        </div>
                        <p className="text-gray-600">Your Google account has been successfully connected.</p>
                        <button
                          onClick={goToNextStep}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Continue to Next Step
                          <ArrowRight className="h-4 w-4 ml-2 inline" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-gray-600">
                          Click the button below to connect your Google account and access Google Analytics, Business Profile, and Search Console data.
                        </p>
                        <button
                          onClick={() => handleStepAction(currentStep)}
                          disabled={isLoading}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Connecting...
                            </div>
                          ) : (
                            'Connect Google Account'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {currentStep.id === 'ga4-property' && (
                  <div>
                    {currentStep.status === 'completed' ? (
                      <div className="text-center space-y-4">
                        <div className="text-green-600">
                          <CheckCircle className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-lg font-medium">Property Selected!</p>
                        </div>
                        <p className="text-gray-600">Your Google Analytics property has been connected.</p>
                        <p className="text-sm text-gray-500">Redirecting to dashboard...</p>
                      </div>
                    ) : (
                      <GA4PropertySelector onPropertySelected={handlePropertySelected} />
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-6 border-t">
                <button
                  onClick={goToPreviousStep}
                  disabled={currentStepIndex === 0}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </button>

                <div className="text-sm text-gray-500">
                  {currentStepIndex + 1} of {onboardingSteps.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <AuthGuard>
      <OnboardingPageContent />
    </AuthGuard>
  )
}
