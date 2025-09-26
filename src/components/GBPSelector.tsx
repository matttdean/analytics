'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Building2, MapPin, Phone, Globe, Check, AlertCircle, Loader2 } from 'lucide-react'
import ConnectGoogle from './ConnectGoogle'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    // Check if it's a specific error we want to handle
    if (data.error === 'missing_google_tokens' || data.error === 'unauthenticated') {
      throw new Error(data.error)
    }
    throw new Error(`HTTP ${response.status}: ${data.message || response.statusText}`)
  }
  
  return data
}

interface Location {
  name: string
  title: string
  address: string
  phone: string
  website: string
  category: string
}

interface Account {
  name: string
  accountName: string
  type: string
  verificationState: string
  vettedState: string
  locations: Location[]
}

interface GBPSelectorProps {
  onLocationSelected?: (location: Location) => void
  onConnected?: () => void
  onGoogleConnected?: () => void
}

export default function GBPSelector({ onLocationSelected, onConnected, onGoogleConnected }: GBPSelectorProps) {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const { data, error, isLoading } = useSWR('/api/google/gbp/accounts', fetcher)

  const handleConnect = async () => {
    if (!selectedLocation) return

    setIsConnecting(true)
    setConnectionStatus('idle')

    try {
      const response = await fetch('/api/google/gbp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationName: selectedLocation.name,
          locationTitle: selectedLocation.title
        })
      })

      if (response.ok) {
        setConnectionStatus('success')
        onConnected?.()
      } else {
        setConnectionStatus('error')
      }
    } catch (error) {
      console.error('Error connecting GBP:', error)
      setConnectionStatus('error')
    } finally {
      setIsConnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Loading Google Business Profile accounts...</span>
      </div>
    )
  }

  if (error) {
    // Check if it's a Google tokens error
    if (error.message === 'missing_google_tokens' || 
        error.message === 'unauthenticated' ||
        error.message?.includes('No Google tokens on file')) {
      return (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <h3 className="ml-2 text-sm font-medium text-blue-800">Connect Your Google Account First</h3>
          </div>
          <p className="mt-2 text-sm text-blue-700">
            To access your Google Business Profile data, you need to connect your Google account first.
          </p>
          <div className="mt-4">
            <ConnectGoogle onConnected={onGoogleConnected} />
          </div>
        </div>
      )
    }

    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <h3 className="ml-2 text-sm font-medium text-red-800">Unable to Load Business Profiles</h3>
        </div>
        <p className="mt-2 text-sm text-red-700">
          {error.message || 'There was an error loading your Google Business Profile accounts. Please try again.'}
        </p>
      </div>
    )
  }

  if (!data?.accounts || data.accounts.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <h3 className="ml-2 text-sm font-medium text-yellow-800">No Business Profiles Found</h3>
        </div>
        <p className="mt-2 text-sm text-yellow-700">
          You don't have any Google Business Profile accounts set up. Please create a business profile first.
        </p>
      </div>
    )
  }

  const allLocations = data.accounts.flatMap((account: Account) => 
    account.locations.map((location: Location) => ({
      ...location,
      accountName: account.accountName
    }))
  )

  if (allLocations.length === 0) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-yellow-600" />
          <h3 className="ml-2 text-sm font-medium text-yellow-800">No Business Locations Found</h3>
        </div>
        <p className="mt-2 text-sm text-yellow-700">
          Your Google Business Profile accounts don't have any locations set up. Please add a location to your business profile.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Select Your Business Location</h3>
        <p className="mt-1 text-sm text-gray-600">
          Choose which Google Business Profile location you want to connect to your dashboard.
        </p>
      </div>

      <div className="space-y-3">
        {allLocations.map((location: Location & { accountName: string }) => (
          <div
            key={location.name}
            className={`cursor-pointer rounded-lg border p-4 transition-colors ${
              selectedLocation?.name === location.name
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => {
              setSelectedLocation(location)
              onLocationSelected?.(location)
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center">
                  <Building2 className="h-5 w-5 text-gray-400" />
                  <h4 className="ml-2 font-medium text-gray-900">{location.title}</h4>
                  {selectedLocation?.name === location.name && (
                    <Check className="ml-2 h-4 w-4 text-blue-600" />
                  )}
                </div>
                
                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {location.address && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="ml-2">{location.address}</span>
                    </div>
                  )}
                  
                  {location.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="ml-2">{location.phone}</span>
                    </div>
                  )}
                  
                  {location.website && (
                    <div className="flex items-center">
                      <Globe className="h-4 w-4 text-gray-400" />
                      <span className="ml-2">{location.website}</span>
                    </div>
                  )}
                  
                  {location.category && (
                    <div className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                        {location.category}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedLocation && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div>
            <h4 className="font-medium text-blue-900">Ready to Connect</h4>
            <p className="text-sm text-blue-700">
              Connect <strong>{selectedLocation.title}</strong> to your dashboard
            </p>
          </div>
          
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="ml-2">Connecting...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span className="ml-2">Connect</span>
              </>
            )}
          </button>
        </div>
      )}

      {connectionStatus === 'success' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-center">
            <Check className="h-5 w-5 text-green-600" />
            <span className="ml-2 text-sm font-medium text-green-800">
              Successfully connected to {selectedLocation?.title}!
            </span>
          </div>
        </div>
      )}

      {connectionStatus === 'error' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <span className="ml-2 text-sm font-medium text-red-800">
              Failed to connect. Please try again.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
