'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Building2, Phone, Globe, MapPin, Clock, Star, TrendingUp, TrendingDown, PhoneCall, MousePointer, Navigation, AlertCircle } from 'lucide-react'
import GBPSelector from '../../../components/GBPSelector'
import ConnectGoogle from '../../../components/ConnectGoogle'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function BusinessProfilePage() {
  const { data, error, isLoading, mutate } = useSWR('/api/data/business-profile', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000 // 5 minutes
  })

  const handleGBPConnected = () => {
    // Refresh the data after connecting
    mutate()
  }

  const handleGoogleConnected = () => {
    // Refresh the data after Google connection
    mutate()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading business profile data...</p>
        </div>
      </div>
    )
  }

  // Handle missing Google tokens - show Connect Google
  if (data?.error === 'missing_google_tokens' || data?.error === 'no_access_token') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
          <p className="mt-2 text-gray-600">Connect your Google account to access your Google Business Profile data.</p>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="ml-2 text-sm font-medium text-blue-800">Connect Your Google Account First</h3>
          </div>
          <p className="mt-2 text-sm text-blue-700">
            To access your Google Business Profile data, you need to connect your Google account first.
          </p>
          <div className="mt-4">
            <ConnectGoogle onConnected={handleGoogleConnected} />
          </div>
        </div>
      </div>
    )
  }

  // Handle GBP connection errors - show selector
  if (data?.error === 'no_gbp_connection_and_api_failed' || 
      data?.error === 'no_gbp_accounts' || 
      data?.error === 'no_gbp_locations' ||
      data?.error === 'no_gbp_location_configured') {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Business Profile</h1>
          <p className="mt-2 text-gray-600">Connect your Google Business Profile to view insights and performance data.</p>
        </div>
        <GBPSelector onConnected={handleGBPConnected} onGoogleConnected={handleGoogleConnected} />
      </div>
    )
  }

  if (error || data?.error) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <Building2 className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">
            {error?.message || data?.error || 'Failed to load business profile data. Please check your Google OAuth connection.'}
          </p>
          <button
            onClick={() => mutate()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-6">
            No business profile data found. Please ensure you have Google Business Profile connected.
          </p>
        </div>
      </div>
    )
  }

  const { business, performance, period } = data

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Business Profile</h1>
        </div>
        <p className="text-gray-600">Manage and monitor your Google Business Profile performance</p>
      </div>

      {/* Business Information */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          Business Information
        </h3>
        
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{business.name}</p>
                <p className="text-sm text-gray-600">{business.category}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Address</p>
                <p className="text-sm text-gray-600">{business.address}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Phone</p>
                <p className="text-sm text-gray-600">{business.phone}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Website</p>
                <p className="text-sm text-gray-600">{business.website}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Hours</p>
                <p className="text-sm text-gray-600">
                  {business.hours && business.hours.length > 0 
                    ? `${business.hours.length} days configured`
                    : 'Hours not set'
                  }
                </p>
              </div>
            </div>
            
            {business.description && (
              <div className="flex items-start gap-3">
                <div className="h-5 w-5 text-gray-400 mt-0.5">📝</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Description</p>
                  <p className="text-sm text-gray-600">{business.description}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <PhoneCall className="h-6 w-6 text-green-600" />
            <span className="text-sm font-medium text-green-700">Phone Calls</span>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {performance.calls.current}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {performance.calls.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm ${performance.calls.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {performance.calls.change >= 0 ? '+' : ''}{performance.calls.change.toFixed(1)}% vs previous period
            </span>
          </div>
          <div className="text-xs text-green-600 mt-1">
            {period.current.start} to {period.current.end}
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <MousePointer className="h-6 w-6 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Website Clicks</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {performance.websiteClicks.current}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {performance.websiteClicks.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-blue-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm ${performance.websiteClicks.change >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
              {performance.websiteClicks.change >= 0 ? '+' : ''}{performance.websiteClicks.change.toFixed(1)}% vs previous period
            </span>
          </div>
          <div className="text-xs text-blue-600 mt-1">
            {period.current.start} to {period.current.end}
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <Navigation className="h-6 w-6 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Directions</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {performance.directionRequests.current}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {performance.directionRequests.change >= 0 ? (
              <TrendingUp className="h-4 w-4 text-purple-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
            <span className={`text-sm ${performance.directionRequests.change >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
              {performance.directionRequests.change >= 0 ? '+' : ''}{performance.directionRequests.change.toFixed(1)}% vs previous period
            </span>
          </div>
          <div className="text-xs text-purple-600 mt-1">
            {period.current.start} to {period.current.end}
          </div>
        </div>
      </div>

      {/* Performance Comparison */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Performance Comparison
        </h3>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {performance.calls.current}
            </div>
            <div className="text-sm text-gray-600 mb-1">Current Period Calls</div>
            <div className="text-xs text-gray-500">
              {period.current.start} to {period.current.end}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Previous: {performance.calls.previous}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {performance.websiteClicks.current}
            </div>
            <div className="text-sm text-gray-600 mb-1">Current Period Website Clicks</div>
            <div className="text-xs text-gray-500">
              {period.current.start} to {period.current.end}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Previous: {performance.websiteClicks.previous}
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-2">
              {performance.directionRequests.current}
            </div>
            <div className="text-sm text-gray-600 mb-1">Current Period Directions</div>
            <div className="text-xs text-gray-500">
              {period.current.start} to {period.current.end}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Previous: {performance.directionRequests.previous}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
