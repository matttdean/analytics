'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { FileText, TrendingUp, Users, AlertCircle } from 'lucide-react'
import ConnectGoogle from '../ConnectGoogle'

const fetcher = (url: string) => fetch(url).then(r => r.json())

const timePeriods = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 }
]

export default function TopPages() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  
  const { data, error, isLoading } = useSWR(
    `/api/data/top-pages?days=${selectedPeriod}`,
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
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Handle missing Google tokens specifically
  if (data?.error === 'missing_google_tokens') {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Top Pages</h3>
              <p className="text-sm text-gray-600">Most visited pages in the last {selectedPeriod} days</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Google Account</h4>
          <p className="text-gray-600 mb-6">
            To view your Google Analytics data, you need to connect your Google account first.
          </p>
          <ConnectGoogle />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-center text-gray-500">
          <FileText className="mx-auto h-8 w-8 mb-2 text-gray-400" />
          <p>Failed to load top pages</p>
        </div>
      </div>
    )
  }

  const topPages = data?.data?.topPages || []

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Top Pages</h3>
          <p className="text-sm text-gray-600">Most visited pages in the last {selectedPeriod} days</p>
        </div>
        
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {timePeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {topPages.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="mx-auto h-8 w-8 mb-2 text-gray-400" />
          <p>No page data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topPages.slice(0, 10).map((page: any, index: number) => (
            <div key={`${page.path}-${page.pageViews}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-blue-600">
                    {index + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {page.title || page.path}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {page.path}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-1 text-gray-600">
                  <FileText className="h-4 w-4" />
                  <span>{page.pageViews.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>{page.sessions.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-1 text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  <span>{page.bounceRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
