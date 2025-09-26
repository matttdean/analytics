'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Star, Video, Image, FileText, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SearchAppearanceMetrics({ days }: { days: number }) {
  const { data, error, isLoading } = useSWR(
    `/api/data/search-console-comprehensive?days=${days}`,
    fetcher
  )

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Search Appearance Data Unavailable</h3>
          <p className="text-gray-600 mb-4">
            {data?.message || error?.message || 'Unable to load Search Console appearance data.'}
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
      {/* Search Appearance Types */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-purple-600" />
          Search Appearance Types
        </h3>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Organic Results</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">{data.summary?.totalImpressions?.toLocaleString() || '0'}</div>
            <div className="text-sm text-gray-600">Impressions</div>
          </div>
        </div>
      </div>

      {/* Performance Insights */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" />
          Performance Insights
        </h3>
        
        <div className="grid gap-6 md:grid-cols-2">
          {/* CTR Analysis */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <h4 className="text-lg font-semibold text-blue-900 mb-3">Click-Through Rate Analysis</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Current CTR</span>
                <span className="text-lg font-bold text-blue-900">{data.summary?.avgCTR || '0'}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-blue-700">Industry Average</span>
                <span className="text-sm text-blue-600">~2.5%</span>
              </div>
            </div>
          </div>

          {/* Position Analysis */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <h4 className="text-lg font-semibold text-green-900 mb-3">Position Analysis</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">Average Position</span>
                <span className="text-lg font-bold text-green-900">{data.summary?.avgPosition || '0'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-green-700">Top 3 Positions</span>
                <span className="text-sm text-green-600">
                  {data.queries?.filter((q: any) => q.position <= 3).length || 0} queries
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
