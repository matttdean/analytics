'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Building2, MapPin, Phone, Globe, Clock, TrendingUp, Eye, MousePointer, Navigation, Star, Users, Calendar, MessageSquare, AlertCircle } from 'lucide-react'
import ConnectGoogle from '../ConnectGoogle'
import GBPSelector from '../GBPSelector'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function BusinessProfile() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/data/business-profile', 
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  )

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
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Handle missing Google tokens specifically
  if (data?.error === 'missing_google_tokens' || data?.error === 'no_access_token') {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Business Profile</h3>
              <p className="text-sm text-gray-600">Google Business Profile insights</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Google Account</h4>
          <p className="text-gray-600 mb-6">
            To view your Google Business Profile data, you need to connect your Google account first.
          </p>
          <ConnectGoogle />
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
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Business Profile</h3>
              <p className="text-sm text-gray-600">Google Business Profile insights</p>
            </div>
          </div>
        </div>

        <GBPSelector onConnected={handleGBPConnected} onGoogleConnected={handleGoogleConnected} />
      </div>
    )
  }

  // Handle API errors (400, 500, etc.)
  if (data?.error) {
    // Handle specific GBP connection errors
    if (data.error === 'no_gbp_location_configured' || 
        data.error === 'no_gbp_connection_and_api_failed' || 
        data.error === 'no_gbp_accounts' || 
        data.error === 'no_gbp_locations') {
      return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Business Profile</h3>
                <p className="text-sm text-gray-600">Google Business Profile insights</p>
              </div>
            </div>
          </div>

          <div className="text-center py-8">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Business Profile</h4>
            <p className="text-gray-600 mb-6">
              Connect your Google Business Profile to view insights, performance metrics, and customer interactions.
            </p>
            <GBPSelector onConnected={handleGBPConnected} onGoogleConnected={handleGoogleConnected} />
          </div>
        </div>
      )
    }

    // Handle other API errors
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Business Profile Unavailable</h3>
          <p className="text-gray-600">
            {data.message || 'Unable to load Google Business Profile data. Please check your connection.'}
          </p>
        </div>
      </div>
    )
  }

  // Handle network errors
  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Business Profile Unavailable</h3>
          <p className="text-gray-600">
            Unable to load Google Business Profile data. Please check your connection.
          </p>
        </div>
      </div>
    )
  }

  if (!data || !data.business) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Business Profile</h3>
              <p className="text-sm text-gray-600">Google Business Profile insights</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Business Profile</h4>
          <p className="text-gray-600 mb-6">
            Connect your Google Business Profile to view insights, performance metrics, and customer interactions.
          </p>
          <GBPSelector onConnected={handleGBPConnected} onGoogleConnected={handleGoogleConnected} />
        </div>
      </div>
    )
  }

  const { business, performance, reviews, location, mock, period } = data

  // Helper function to format address
  const formatAddress = (address: any) => {
    if (!address) return 'Address not available'
    const parts = [
      address.addressLines?.[0],
      address.locality,
      address.administrativeArea,
      address.postalCode
    ].filter(Boolean)
    return parts.join(', ')
  }

  // Helper function to get performance value
  const getPerfValue = (metric: 'CALL_CLICKS' | 'WEBSITE_CLICKS' | 'DRIVING_DIRECTIONS') => {
    if (data?.performance) {
      switch (metric) {
        case 'CALL_CLICKS': return data.performance.calls?.current ?? 0
        case 'WEBSITE_CLICKS': return data.performance.websiteClicks?.current ?? 0
        case 'DRIVING_DIRECTIONS': return data.performance.directionRequests?.current ?? 0
      }
    }
    // legacy fallback (if your backend ever returns insights.metricValues again)
    const mv = data?.insights?.metricValues
    if (Array.isArray(mv)) {
      const found = mv.find((m: any) => m.metric === metric)
      return Number(found?.value ?? 0)
    }
    return 0
  }

  // Helper function to calculate average rating
  const getAverageRating = () => {
    if (!reviews?.reviews || reviews.reviews.length === 0) return null
    
    const totalRating = reviews.reviews.reduce((sum: number, review: any) => 
      sum + (review.starRating || 0), 0)
    return (totalRating / reviews.reviews.length).toFixed(1)
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Business Profile</h3>
            <p className="text-sm text-gray-600">Google Business Profile insights</p>
          </div>
        </div>
        {mock && (
          <div className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
            Demo Data
          </div>
        )}
        {!mock && (
          <div className="px-3 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            Live Data
          </div>
        )}
      </div>

      {/* Business Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">{business?.name || 'Business Name Not Available'}</p>
              <p className="text-sm text-gray-600">{business?.category || 'Category Not Available'}</p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3">
            <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Address</p>
              <p className="text-sm text-gray-600">{formatAddress(business?.address)}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Phone</p>
              <p className="text-sm text-gray-600">{business?.phone || 'Not available'}</p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Website</p>
              <p className="text-sm text-gray-600">
                {business?.website ? (
                  <a href={business.website} target="_blank" rel="noopener noreferrer" 
                     className="text-blue-600 hover:text-blue-800">
                    {business.website.replace(/^https?:\/\//, '')}
                  </a>
                ) : 'Not available'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Status</p>
              <p className="text-sm text-gray-600 capitalize">
                {business?.status?.toLowerCase() || 'Unknown'}
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3">
            <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">Last Updated</p>
              <p className="text-sm text-gray-600">Today</p>
            </div>
          </div>

          {reviews && reviews.reviews && reviews.reviews.length > 0 && (
            <div className="flex items-start space-x-3">
              <Star className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">Average Rating</p>
                <p className="text-sm text-gray-600">{getAverageRating()} / 5.0</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Performance Insights */}
      <div className="border-t pt-6">
        <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-green-600" />
          Performance (Last {data?.period?.current ? `${data.period.current.start} → ${data.period.current.end}` : '28 days'})
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Phone className="h-5 w-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{getPerfValue('CALL_CLICKS')}</p>
            <p className="text-xs text-gray-600">Phone Calls</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <MousePointer className="h-5 w-5 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{getPerfValue('WEBSITE_CLICKS')}</p>
            <p className="text-xs text-gray-600">Website Clicks</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Navigation className="h-5 w-5 text-orange-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{getPerfValue('DRIVING_DIRECTIONS')}</p>
            <p className="text-xs text-gray-600">Directions</p>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {reviews && reviews.reviews && reviews.reviews.length > 0 && (
        <div className="border-t pt-6 mt-6">
          <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
            <MessageSquare className="h-4 w-4 mr-2 text-blue-600" />
            Recent Reviews ({reviews.reviews.length})
          </h4>
          
          <div className="space-y-3">
            {reviews.reviews.slice(0, 3).map((review: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-4 w-4 ${i < (review.starRating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600">({review.starRating || 0}/5)</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(review.createTime).toLocaleDateString()}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-sm text-gray-700">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mock && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
            </div>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Note: This is sample data</p>
              <p>To see real Google Business Profile data, you'll need to enable the Google My Business API and ensure your OAuth scope includes business profile access.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
