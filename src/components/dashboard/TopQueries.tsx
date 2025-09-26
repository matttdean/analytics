'use client'

import { useState } from 'react'
import { Search, TrendingUp, Eye, MousePointer, AlertCircle, Info, Link } from 'lucide-react'
import useSWR from 'swr'
import ConnectGoogle from '../ConnectGoogle'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const timePeriods = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 }
]

export default function TopQueries() {
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
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
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

  // Show mock data notice if applicable
  const isMockData = data?.mock === true



  // Handle missing Google tokens or GSC connections specifically
  const hasMissingTokens = data?.error === 'missing_google_tokens' || 
                          error?.message?.includes('missing_google_tokens') ||
                          data?.error === 'no_gsc_connection' ||
                          (data?.error && data.error.includes('missing')) ||
                          (error && error.message && error.message.includes('missing'))

  // Check if we have available sites that need connection
  const hasAvailableSites = data?.needsConnection === true && data?.sites && data.sites.length > 0

  if (hasMissingTokens) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
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
          <Link className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Search Console</h4>
          <p className="text-gray-600 mb-6">
            {data?.error === 'no_gsc_connection' 
              ? 'You need to connect a Search Console site to view search query data.'
              : 'To view your Search Console data, you need to connect your Google account first.'
            }
          </p>
          <ConnectGoogle />
        </div>
      </div>
    )
  }

  // Handle case where sites are available but need connection
  if (hasAvailableSites) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Search className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Connect Search Console Site</h3>
              <p className="text-sm text-gray-600">Available sites found! Connect one to view data.</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <div className="mb-6">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Available Sites:</h4>
            <div className="space-y-2">
              {data.sites.map((site: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg max-w-md mx-auto">
                  <span className="text-sm font-medium text-gray-900">{site.siteUrl}</span>
                  <span className="text-xs text-gray-500 capitalize">{site.permissionLevel}</span>
                </div>
              ))}
            </div>
          </div>
          
          <p className="text-gray-600 mb-6">
            Click below to connect your Search Console site and start viewing data.
          </p>
          
          <button
            onClick={async () => {
              if (!confirm(`Connect ${data.sites[0]?.siteUrl} to your dashboard?`)) {
                return
              }
              
              try {
                const res = await fetch('/api/google/gsc/connect', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ siteUrl: data.sites[0].siteUrl })
                })
                
                const result = await res.json()
                if (result.success) {
                  alert('Search Console site connected successfully!')
                  window.location.reload()
                } else {
                  alert(`Failed to connect: ${result.error}`)
                }
              } catch (error) {
                alert(`Error connecting site: ${error}`)
              }
            }}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Connect {data.sites[0]?.siteUrl?.replace('sc-domain:', '')}
          </button>
        </div>
      </div>
    )
  }

  // Handle other errors
  if (error || data?.error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Top Search Queries</h3>
              <p className="text-sm text-gray-600">Most popular search terms driving traffic</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Failed to Load Search Queries</h4>
          <p className="text-gray-600 mb-4">
            {data?.message || error?.message || 'An error occurred while fetching search data'}
          </p>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-2xl mx-auto">
            <h5 className="text-sm font-medium text-red-900 mb-2">Error Details:</h5>
            <p className="text-sm text-red-800">
              {data?.details || 'Unknown error occurred'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Show actual data if available
  const queries = data?.queries || []
  const hasData = queries.length > 0

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Search className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Top Search Queries</h3>
            <p className="text-sm text-gray-600">
              {hasData 
                ? `Most popular search terms driving traffic (${data.days || data.period || '28'} days)`
                : 'Search query performance data'
              }
            </p>
          </div>
        </div>
        
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(Number(e.target.value))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timePeriods.map((period) => (
            <option key={period.value} value={period.value}>
              {period.label}
            </option>
          ))}
        </select>
      </div>

      {!hasData && (
        <div className="text-center py-8">
          <Info className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Search Data Available</h4>
          <p className="text-gray-600">
            {data?.message || 'No search queries data found for the selected time period'}
          </p>
        </div>
      )}

      {hasData && (
        <>
          {isMockData && (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">Demo Data</p>
                  <p>{data.note || 'Unable to fetch real data from Search Console. This shows what the data would look like.'}</p>
                  {data.error && (
                    <p className="mt-2 text-xs text-yellow-700">
                      <strong>Error:</strong> {data.error}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {queries.map((item: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{item.query}</h4>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span className="flex items-center space-x-1">
                        <MousePointer className="h-4 w-4" />
                        <span>{item.clicks} clicks</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Eye className="h-4 w-4" />
                        <span>{item.impressions} impressions</span>
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {typeof item.ctr === 'number' ? `${item.ctr.toFixed(1)}%` : `${(item.ctr * 100).toFixed(1)}%`} CTR
                  </div>
                  <div className="text-sm text-gray-600">
                    Position {item.position.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {hasData && (
        <div className="mt-4 text-center">
          <p className="text-sm text-gray-500">
            {isMockData ? (
              <>
                Demo data • {queries.length} sample queries
                <br />
                <span className="text-xs text-gray-400">
                  Real data unavailable due to API limitations
                </span>
              </>
            ) : (
              `Real data from Search Console • ${queries.length} queries`
            )}
          </p>
        </div>
      )}
    </div>
  )
}
