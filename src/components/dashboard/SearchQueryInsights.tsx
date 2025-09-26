'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Lightbulb, TrendingUp, Target, Users, Search, BarChart3 } from 'lucide-react'

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function SearchQueryInsights({ days }: { days: number }) {
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
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Search Query Insights Unavailable</h3>
          <p className="text-gray-600 mb-4">
            {data?.message || error?.message || 'Unable to load Search Console query insights.'}
          </p>
          <p className="text-sm text-gray-500">
            Make sure you have connected a Search Console site and have verified it in Google Search Console.
          </p>
        </div>
      </div>
    )
  }

  // Analyze query patterns with null safety
  const queries = data.queries || []
  const queryAnalysis = {
    totalQueries: queries.length,
    highCTRQueries: queries.filter((q: any) => q.ctr > 5).length,
    topPositionQueries: queries.filter((q: any) => q.position <= 3).length,
    longTailQueries: queries.filter((q: any) => q.query?.split(' ').length > 3).length,
    shortTailQueries: queries.filter((q: any) => q.query?.split(' ').length <= 2).length
  }

  return (
    <div className="space-y-6">
      {/* Query Analysis Overview */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
          Query Analysis Overview
        </h3>
        
        <div className="grid gap-4 md:grid-cols-5">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
            <div className="text-2xl font-bold text-blue-900">{queryAnalysis.totalQueries}</div>
            <div className="text-sm text-blue-600">Total Queries</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
            <div className="text-2xl font-bold text-green-900">{queryAnalysis.highCTRQueries}</div>
            <div className="text-sm text-green-600">High CTR (&gt;5%)</div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-4 border border-purple-200">
            <div className="text-2xl font-bold text-purple-900">{queryAnalysis.topPositionQueries}</div>
            <div className="text-sm text-purple-600">Top 3 Positions</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 border border-orange-200">
            <div className="text-2xl font-bold text-orange-900">{queryAnalysis.longTailQueries}</div>
            <div className="text-sm text-orange-600">Long-tail (4+ words)</div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-4 border border-red-200">
            <div className="text-2xl font-bold text-red-900">{queryAnalysis.shortTailQueries}</div>
            <div className="text-sm text-red-600">Short-tail (≤2 words)</div>
          </div>
        </div>
      </div>

      {/* Seasonal Insights */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-indigo-600 mt-0.5" />
          <div className="text-sm text-indigo-800">
            <p className="font-medium mb-2">Seasonal Search Insights</p>
            <p>
              Based on your {days}-day data, you're seeing{' '}
              <strong>{queryAnalysis.totalQueries}</strong> unique search queries. 
              {queryAnalysis.longTailQueries > queryAnalysis.shortTailQueries ? 
                ' Your long-tail queries are performing well, indicating strong content depth.' :
                ' Focus on creating more specific, long-tail content to capture niche search traffic.'
              }
              {' '}Consider seasonal content planning and keyword research to maintain momentum.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
