'use client'

import { useState, useEffect } from 'react'
import { BarChart3, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface GA4Property {
  propertyId: string
  propertyDisplayName: string
  accountDisplayName: string
}

export default function GA4PropertySelector({ onPropertySelected }: { onPropertySelected: () => void }) {
  const [selectedProperty, setSelectedProperty] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  // Fetch available GA4 properties
  const { data: apiResponse, error: fetchError, mutate: refreshProperties } = useSWR(
    '/api/google/ga4/properties',
    fetcher
  )

  // Extract properties from the API response - the API returns { items: [...] }
  const properties: GA4Property[] = apiResponse?.items || []

  const handlePropertySelect = async () => {
    if (!selectedProperty) return

    setIsLoading(true)
    setError('')

    try {
      const response = await fetch('/api/google/ga4/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ propertyId: selectedProperty }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to select property')
      }

      // Property selected successfully
      await refreshProperties()
      onPropertySelected()
    } catch (err: any) {
      setError(err.message || 'Failed to select property')
    } finally {
      setIsLoading(false)
    }
  }

  if (fetchError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to Load Properties</h3>
        <p className="text-red-700 mb-4">Unable to fetch your Google Analytics properties.</p>
        <button
          onClick={() => refreshProperties()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!apiResponse) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
        <Loader2 className="h-12 w-12 text-blue-500 mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Properties</h3>
        <p className="text-gray-600">Fetching your Google Analytics properties...</p>
      </div>
    )
  }

  // Debug: Log the API response to see the structure
  console.log('GA4 Properties API Response:', apiResponse)
  console.log('Extracted properties:', properties)

  if (!Array.isArray(properties) || properties.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <BarChart3 className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-yellow-900 mb-2">No Properties Found</h3>
        <p className="text-yellow-700 mb-4">
          No Google Analytics 4 properties were found for your account.
        </p>
        <p className="text-yellow-600 text-sm mb-4">
          Make sure you have access to GA4 properties and try refreshing.
        </p>
        <div className="text-left bg-white p-4 rounded border text-xs text-gray-600 max-h-32 overflow-y-auto">
          <strong>Debug Info:</strong><br/>
          API Response: {JSON.stringify(apiResponse, null, 2)}
        </div>
        <button
          onClick={() => refreshProperties()}
          className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
        >
          Refresh Properties
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="text-center mb-6">
        <BarChart3 className="h-12 w-12 text-blue-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Your Analytics Property</h3>
        <p className="text-gray-600">
          Choose which website or app you want to track with Google Analytics 4
        </p>
      </div>

      <div className="space-y-3 mb-6">
        {properties.map((property) => (
          <label
            key={property.propertyId}
            className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
              selectedProperty === property.propertyId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <input
              type="radio"
              name="property"
              value={property.propertyId}
              checked={selectedProperty === property.propertyId}
              onChange={(e) => setSelectedProperty(e.target.value)}
              className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
            />
            <div className="ml-3 flex-1">
              <div className="font-medium text-gray-900">{property.propertyDisplayName}</div>
              <div className="text-sm text-gray-500">
                Account: {property.accountDisplayName} • ID: {property.propertyId}
              </div>
            </div>
            {selectedProperty === property.propertyId && (
              <CheckCircle className="h-5 w-5 text-blue-500" />
            )}
          </label>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={handlePropertySelect}
          disabled={!selectedProperty || isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Connecting...
            </div>
          ) : (
            'Connect Property'
          )}
        </button>
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        <p>This will be your primary data source for analytics and insights.</p>
      </div>
    </div>
  )
}
