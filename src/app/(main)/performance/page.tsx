'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Target, TrendingUp, AlertTriangle, CheckCircle, Clock, Zap, BarChart3, Activity } from 'lucide-react'

// TypeScript interfaces for better type safety
interface CoreWebVital {
  score: number
  status: 'good' | 'needs-improvement' | 'poor' | 'loading'
  target: string
}

interface CoreWebVitals {
  lcp: CoreWebVital
  fid: CoreWebVital
  cls: CoreWebVital
  ttfb: CoreWebVital
  fcp: CoreWebVital
}

interface PerformanceRecommendation {
  title: string
  description: string
  priority: 'High' | 'Medium' | 'Low'
}

interface PerformanceData {
  performanceScore: number
  coreWebVitals: CoreWebVitals
  recommendations: PerformanceRecommendation[]
  pageViews?: number
  avgLoadTime?: number
  bounceRate?: number
}

interface OverviewData {
  // Add properties as needed based on your API response
  [key: string]: any
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function PerformancePage() {
  const [siteUrl, setSiteUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Separate API calls for progressive loading
  const { data: performanceData, error: performanceError, isLoading: performanceLoading } = useSWR<PerformanceData>(
    isAnalyzing && siteUrl ? `/api/data/performance?days=28&url=${encodeURIComponent(siteUrl)}` : null,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 300000 // 5 minutes
    }
  )

  const { data: overviewData } = useSWR<OverviewData>(
    isAnalyzing ? `/api/data/overview?days=28` : null,
    fetcher
  )

  // Extract analytics data separately for immediate display
  const analyticsData = performanceData ? {
    pageViews: performanceData.pageViews || 0,
    avgLoadTime: performanceData.avgLoadTime || 0,
    bounceRate: performanceData.bounceRate || 0
  } : null

  // Extract PageSpeed data separately
  const pageSpeedData = performanceData ? {
    performanceScore: performanceData.performanceScore || 0,
    coreWebVitals: performanceData.coreWebVitals || {},
    recommendations: performanceData.recommendations || []
  } : null

  // Use real Core Web Vitals data from API
  const coreWebVitals: CoreWebVitals = pageSpeedData?.coreWebVitals || {
    lcp: { score: 0, status: 'loading', target: '< 2.5s' },
    fid: { score: 0, status: 'loading', target: '< 100ms' },
    cls: { score: 0, status: 'loading', target: '< 0.1' },
    ttfb: { score: 0, status: 'loading', target: '< 200ms' },
    fcp: { score: 0, status: 'loading', target: '< 1.8s' }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'good': return 'text-green-600 bg-green-100'
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-100'
      case 'poor': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-4 w-4" />
      case 'needs-improvement': return <AlertTriangle className="h-4 w-4" />
      case 'poor': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  // Use real recommendations from API
  const performanceRecommendations: PerformanceRecommendation[] = pageSpeedData?.recommendations || []

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 flex items-center justify-center">
            <Target className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Performance</h1>
        </div>
        <p className="text-gray-600">Monitor and optimize your website's performance metrics</p>
        
        {/* Error Display */}
        {performanceError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Error loading performance data</span>
            </div>
            <p className="text-red-600 text-sm mt-1">
              {performanceError.message || 'Failed to fetch performance data. Please check your Google OAuth connection.'}
            </p>
          </div>
        )}

        {/* Loading Status */}
        {performanceLoading && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
              <span className="font-medium">Analyzing Website Performance</span>
            </div>
            <p className="text-blue-600 text-sm mt-1">
              PageSpeed Insights is running a comprehensive analysis. This may take 15-30 seconds. 
              GA4 data is already loaded and displayed above.
            </p>
          </div>
        )}
      </div>

      {/* Site URL Input - Main Action */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-200 p-8 mb-8">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Test Your Website Performance</h2>
          <p className="text-gray-600">Enter your website URL to get detailed performance insights</p>
        </div>
        
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3">
            <input
              type="url"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && siteUrl.trim()) {
                  let url = siteUrl.trim()
                  
                  // Add https:// if no protocol is specified
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`
                  }
                  
                  // Ensure it starts with https:// (prefer https over http)
                  if (url.startsWith('http://')) {
                    url = url.replace('http://', 'https://')
                  }
                  
                  setSiteUrl(url)
                  setIsAnalyzing(true)
                }
              }}
              placeholder="https://yourwebsite.com"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
            />
            <button
              onClick={() => {
                if (siteUrl.trim()) {
                  let url = siteUrl.trim()
                  
                  // Add https:// if no protocol is specified
                  if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = `https://${url}`
                  }
                  
                  // Ensure it starts with https:// (prefer https over http)
                  if (url.startsWith('http://')) {
                    url = url.replace('http://', 'https://')
                  }
                  
                  setSiteUrl(url)
                  setIsAnalyzing(true)
                }
              }}
              disabled={!siteUrl || siteUrl.length < 10}
              className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                siteUrl && siteUrl.length >= 10
                  ? 'bg-purple-600 text-white hover:bg-purple-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Analyze
            </button>
          </div>
        </div>
      </div>

      {/* Default State - No Analysis Started */}
      {!isAnalyzing && (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <div className="h-20 w-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Target className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Ready to Test Performance?</h3>
            <p className="text-gray-600 mb-6">
              Enter your website URL above to get detailed performance insights, Core Web Vitals, and optimization recommendations.
            </p>
          </div>
        </div>
      )}

      {/* Performance Overview - Only show when analysis is started */}
      {isAnalyzing && siteUrl && (
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="h-6 w-6 text-green-600" />
              <span className="text-sm font-medium text-green-700">Performance Score</span>
            </div>
            <div className="text-3xl font-bold text-green-900">
              {performanceLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                `${pageSpeedData?.performanceScore || 0}/100`
              )}
            </div>
            <div className="text-sm text-green-600">
              {(pageSpeedData?.performanceScore || 0) >= 90 ? 'Excellent' : 
               (pageSpeedData?.performanceScore || 0) >= 70 ? 'Good' : 
               (pageSpeedData?.performanceScore || 0) >= 50 ? 'Needs Improvement' : 'Poor'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">Avg Load Time</span>
            </div>
            <div className="text-3xl font-bold text-blue-900">
              {analyticsData ? (
                `${analyticsData.avgLoadTime}s`
              ) : performanceLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span>Loading...</span>
                </div>
              ) : (
                '0s'
              )}
            </div>
            <div className="text-sm text-blue-600">
              {(analyticsData?.avgLoadTime || 0) <= 1 ? 'Fast' : 
               (analyticsData?.avgLoadTime || 0) <= 3 ? 'Moderate' : 'Slow'}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200">
            <div className="flex items-center gap-3 mb-3">
              <Zap className="h-6 w-6 text-purple-600" />
              <span className="text-sm font-medium text-purple-700">Core Web Vitals</span>
            </div>
            <div className="text-3xl font-bold text-purple-900">
              {pageSpeedData ? (
                `${Object.values(pageSpeedData.coreWebVitals).filter((v: CoreWebVital) => v.status === 'good').length}/5`
              ) : performanceLoading ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"></div>
                  <span>Analyzing...</span>
                </div>
              ) : (
                '0/5'
              )}
            </div>
            <div className="text-sm text-purple-600">
              {pageSpeedData ? 
               (Object.values(pageSpeedData.coreWebVitals).filter((v: CoreWebVital) => v.status === 'good').length >= 4 ? 'Good' : 
                Object.values(pageSpeedData.coreWebVitals).filter((v: CoreWebVital) => v.status === 'good').length >= 2 ? 'Needs Improvement' : 'Poor') :
               'Loading...'}
            </div>
          </div>
        </div>
      )}

      {/* Rest of the content - Only show when analysis is started */}
      {isAnalyzing && siteUrl && (
        <>
          {/* Core Web Vitals */}
          <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              Core Web Vitals
            </h2>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {Object.entries(coreWebVitals).map(([metric, data]) => (
                <div key={metric} className="bg-gray-50 rounded-xl p-4 border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700 uppercase">{metric}</span>
                    <div className={`p-1 rounded-full ${getStatusColor(data.status)}`}>
                      {getStatusIcon(data.status)}
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {typeof data.score === 'number' && data.score < 1 ? data.score.toFixed(2) : data.score}
                    {metric === 'lcp' || metric === 'fcp' ? 's' : metric === 'cls' ? '' : 'ms'}
                  </div>
                  <div className="text-sm text-gray-600">Target: {data.target}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Recommendations */}
          <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Performance Recommendations
            </h2>
            
            <div className="space-y-4">
              {performanceRecommendations.length > 0 ? (
                performanceRecommendations.map((rec, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="mb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{rec.title}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          rec.priority === 'High' ? 'bg-red-100 text-red-700' :
                          rec.priority === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{rec.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          // Open Google search for the specific performance topic
                          const searchTerm = encodeURIComponent(`${rec.title} web performance optimization`)
                          window.open(`https://www.google.com/search?q=${searchTerm}`, '_blank')
                        }}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Learn More
                      </button>
                      <button 
                        onClick={() => {
                          // Store dismissed recommendations in localStorage
                          const dismissed = JSON.parse(localStorage.getItem('dismissedRecommendations') || '[]')
                          dismissed.push(rec.title)
                          localStorage.setItem('dismissedRecommendations', JSON.stringify(dismissed))
                          // You could also add a state update here to hide the dismissed item
                        }}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  {performanceLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                      <span>Analyzing performance...</span>
                    </div>
                  ) : (
                    <div>
                      <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                      <p className="font-medium text-gray-700 mb-1">Great Performance!</p>
                      <p className="text-sm">No major performance issues detected.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Performance Trends */}
          <div className="bg-white rounded-2xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Performance Trends
            </h2>
            
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-900 mb-2">Performance Analysis Complete</div>
                <p className="text-blue-700">
                  Your website performance has been analyzed. Review the metrics above and implement the recommendations to improve your site's speed and user experience.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
