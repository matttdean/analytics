'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Globe, Monitor, Smartphone, Tablet, MapPin, ExternalLink, TrendingUp, Users, MousePointer, Target } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

interface SearchConsoleData {
  queries: any[]
  pages: any[]
  devices: any[]
  countries: any[]
  summary: {
    totalClicks: number
    totalImpressions: number
    avgCTR: string
    avgPosition: string
  }
  dateRange: {
    start: string
    end: string
    days: number
  }
  siteUrl: string
}

export default function SearchConsoleMetrics({ days }: { days: number }) {
  const { data, error, isLoading } = useSWR<SearchConsoleData>(
    `/api/data/search-console-comprehensive?days=${days}`,
    fetcher
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data || data?.error) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="text-center py-8">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Search Console Data Unavailable</h3>
          <p className="text-gray-600 mb-4">
            {data?.message || error?.message || 'Unable to load Search Console data. Please check your connection.'}
          </p>
          <p className="text-sm text-gray-500">
            Make sure you have connected a Search Console site and have verified it in Google Search Console.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Landing Pages */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-blue-600" />
          Top Landing Pages
        </h3>
        
        {data.pages && data.pages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clicks</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Impressions</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CTR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.pages.slice(0, 10).map((page: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                      <a 
                        href={page.page} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {page.page.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{page.clicks}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{page.impressions.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{page.ctr.toFixed(2)}%</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{page.position.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4">No page data available</p>
        )}
      </div>

      {/* Performance Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Search Console Insights</p>
            <p>
              Your site received <strong>{data.summary?.totalClicks?.toLocaleString() || '0'}</strong> clicks from{' '}
              <strong>{data.summary?.totalImpressions?.toLocaleString() || '0'}</strong> impressions over the last{' '}
              <strong>{data.dateRange?.days || days}</strong> days. With an average CTR of{' '}
              <strong>{data.summary?.avgCTR || '0'}%</strong> and position{' '}
              <strong>{data.summary?.avgPosition || '0'}</strong>, you're performing{' '}
              {parseFloat(data.summary?.avgCTR || '0') > 3 ? 'above average' : 'at industry standard'} levels.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
