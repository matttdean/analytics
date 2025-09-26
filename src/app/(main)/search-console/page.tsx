'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Search, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react'
import SearchConsoleMetrics from '../../../components/dashboard/SearchConsoleMetrics'
import SearchAppearanceMetrics from '../../../components/dashboard/SearchAppearanceMetrics'
import SearchQueryInsights from '../../../components/dashboard/SearchQueryInsights'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SearchConsolePage() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  


  const { data: searchQueriesData, error: searchQueriesError, isLoading: searchQueriesLoading } = useSWR(
    `/api/data/search-queries?days=${selectedPeriod}`,
    fetcher
  )

  const timePeriods = [
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '28 days', value: 28 },
    { label: '90 days', value: 90 }
  ]

  const mockSearchQueries = [
    { query: 'web design services', clicks: 45, impressions: 1200, ctr: 3.75, position: 2.3 },
    { query: 'graphic design portfolio', clicks: 38, impressions: 890, ctr: 4.27, position: 1.8 },
    { query: 'logo design company', clicks: 32, impressions: 750, ctr: 4.27, position: 2.1 },
    { query: 'brand identity design', clicks: 28, impressions: 680, ctr: 4.12, position: 2.5 },
    { query: 'UI/UX design services', clicks: 25, impressions: 520, ctr: 4.81, position: 1.9 }
  ]

  const mockPerformanceData = [
    { date: '2025-08-22', clicks: 45, impressions: 1200, ctr: 3.75, position: 2.3 },
    { date: '2025-08-23', clicks: 52, impressions: 1350, ctr: 3.85, position: 2.1 },
    { date: '2025-08-24', clicks: 38, impressions: 980, ctr: 3.88, position: 2.4 },
    { date: '2025-08-25', clicks: 61, impressions: 1420, ctr: 4.30, position: 1.9 },
    { date: '2025-08-26', clicks: 47, impressions: 1180, ctr: 3.98, position: 2.2 },
    { date: '2025-08-27', clicks: 55, impressions: 1280, ctr: 4.30, position: 2.0 },
    { date: '2025-08-28', clicks: 42, impressions: 1100, ctr: 3.82, position: 2.3 }
  ]

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 flex items-center justify-center">
            <Search className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Search Console</h1>
        </div>
        <p className="text-gray-600">Monitor your website's search performance and visibility</p>
      </div>



      {/* Time Period Selection */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-medium text-gray-700">Time Period</span>
        </div>
        <div className="flex gap-2">
          {timePeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h2>
        
        <div className="grid gap-6 md:grid-cols-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">
              {searchQueriesData?.queries ? 
                searchQueriesData.queries.reduce((sum: number, q: any) => sum + q.clicks, 0) : 
                '320'
              }
            </div>
            <div className="text-sm text-blue-600">Total Clicks</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-900">
              {searchQueriesData?.queries ? 
                searchQueriesData.queries.reduce((sum: number, q: any) => sum + q.impressions, 0).toLocaleString() : 
                '7,610'
              }
            </div>
            <div className="text-sm text-green-600">Total Impressions</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-900">
              {searchQueriesData?.queries ? 
                (searchQueriesData.queries.reduce((sum: number, q: any) => sum + q.ctr, 0) / searchQueriesData.queries.length).toFixed(2) + '%' : 
                '4.21%'
              }
            </div>
            <div className="text-sm text-purple-600">Average CTR</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
            <div className="text-2xl font-bold text-orange-900">
              {searchQueriesData?.queries ? 
                (searchQueriesData.queries.reduce((sum: number, q: any) => sum + q.position, 0) / searchQueriesData.queries.length).toFixed(1) : 
                '2.1'
              }
            </div>
            <div className="text-sm text-orange-600">Average Position</div>
          </div>
        </div>

        {searchQueriesData?.mock ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Demo Data</p>
                <p>{searchQueriesData.note || 'Unable to fetch real data from Search Console. The metrics shown above are for demonstration purposes.'}</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Top Search Queries */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Search Queries</h2>
        
        {searchQueriesLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
          </div>
        ) : searchQueriesError ? (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-600">Failed to load search queries</p>
          </div>
        ) : searchQueriesData?.queries && searchQueriesData.queries.length > 0 ? (
          <div className="space-y-4">
            {searchQueriesData.mock && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Demo Data</p>
                    <p>{searchQueriesData.note || 'Unable to fetch real data from Search Console. This shows what the data would look like.'}</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Query</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {searchQueriesData.queries.map((query: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{query.query}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{query.clicks}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{query.impressions.toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{query.ctr.toFixed(2)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{query.position.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No search queries data available for the selected time period</p>
          </div>
        )}
      </div>

      {/* Additional Search Console Metrics */}
      <SearchConsoleMetrics days={selectedPeriod} />
      
      {/* Search Appearance & Insights */}
      <SearchAppearanceMetrics days={selectedPeriod} />
      
      {/* Query Insights & Analysis */}
      <SearchQueryInsights days={selectedPeriod} />
    </>
  )
}
