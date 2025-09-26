'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search, TrendingUp, Eye, MousePointer, AlertCircle } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const timePeriods = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 }
]

export default function SimpleTopQueries() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  
  const { data, error, isLoading } = useSWR(
    `/api/data/search-queries?days=${selectedPeriod}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded w-full"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || data?.error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Search className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Top Search Queries</h3>
              <p className="text-sm text-gray-600">Most popular search terms driving traffic</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Search Console Not Connected</h4>
          <p className="text-gray-600">
            Connect your Search Console site to view search query data.
          </p>
        </div>
      </div>
    )
  }

  const queries = data?.queries || []

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Search className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Top Search Queries</h3>
            <p className="text-sm text-gray-600">Most popular search terms driving traffic</p>
          </div>
        </div>
      </div>

      {/* Time Period Selection */}
      <div className="mb-6">
        <div className="flex gap-2">
          {timePeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {queries.length === 0 ? (
        <div className="text-center py-8">
          <Search className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Search Data</h4>
          <p className="text-gray-600">
            No search queries found for the selected time period.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queries.slice(0, 10).map((query: any, index: number) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{query.query}</div>
                <div className="text-sm text-gray-500">
                  {query.clicks} clicks • {query.impressions} impressions
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">
                  {query.ctr}% CTR
                </div>
                <div className="text-sm text-gray-500">
                  Position {query.position}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}


