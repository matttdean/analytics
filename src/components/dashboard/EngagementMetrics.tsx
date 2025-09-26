'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { Clock, MousePointer, TrendingUp, Target, Users, AlertCircle } from 'lucide-react'
import ConnectGoogle from '../ConnectGoogle'

const fetcher = async (url: string) => {
  const response = await fetch(url)
  if (!response.ok) {
    const error = new Error('An error occurred while fetching the data.')
    error.status = response.status
    error.message = response.statusText
    throw error
  }
  return response.json()
}

const timePeriods = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 }
]

// Helper function to format GA4 dates (YYYYMMDD format)
const formatGA4Date = (dateValue: string | number) => {
  // GA4 returns dates as YYYYMMDD format, need to parse it
  if (typeof dateValue === 'string' && dateValue.length === 8) {
    const year = dateValue.substring(0, 4)
    const month = dateValue.substring(4, 6)
    const day = dateValue.substring(6, 8)
    return new Date(`${year}-${month}-${day}`)
  }
  // Fallback for other formats
  return new Date(dateValue)
}

export default function EngagementMetrics() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  
  const { data, error, isLoading } = useSWR(
    `/api/data/engagement-metrics?days=${selectedPeriod}`,
    fetcher
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
              <Target className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Engagement Metrics</h3>
              <p className="text-sm text-gray-600">Bounce rate, session duration, and user engagement</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Google Account</h4>
          <p className="text-sm text-gray-600 mb-6">
            To view your engagement metrics data, you need to connect your Google account first.
          </p>
          <ConnectGoogle />
        </div>
      </div>
    )
  }

  if (error) {
    // Check if it's an authentication error
    if (error.status === 401 || error.message?.includes('unauthenticated')) {
      return (
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="text-center py-8">
            <AlertCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h4>
            <p className="text-gray-600 mb-6">
              Your session has expired. Please refresh the page or sign in again.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }
    
    return (
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-center text-gray-500">
          <Target className="mx-auto h-8 w-8 mb-2 text-gray-400" />
          <p>Failed to load engagement metrics</p>
        </div>
      </div>
    )
  }

  // Use real data if available, otherwise fallback to mock data
  const engagementData = data?.engagementData || [
    { date: '2025-08-22', bounce_rate: 42.5, session_duration: 185, pages_per_session: 3.2, conversion_rate: 2.8 },
    { date: '2025-08-23', bounce_rate: 41.2, session_duration: 192, pages_per_session: 3.4, conversion_rate: 3.1 },
    { date: '2025-08-24', bounce_rate: 43.8, session_duration: 178, pages_per_session: 3.1, conversion_rate: 2.6 },
    { date: '2025-08-25', bounce_rate: 40.1, session_duration: 201, pages_per_session: 3.6, conversion_rate: 3.4 },
    { date: '2025-08-26', bounce_rate: 39.8, session_duration: 195, pages_per_session: 3.3, conversion_rate: 3.2 },
    { date: '2025-08-27', bounce_rate: 41.5, session_duration: 188, pages_per_session: 3.2, conversion_rate: 2.9 },
    { date: '2025-08-28', bounce_rate: 38.9, session_duration: 210, pages_per_session: 3.7, conversion_rate: 3.6 }
  ]

  // Use real summary data if available, otherwise calculate from engagement data
  const avgBounceRate = data?.summary?.avgBounceRate || (engagementData.reduce((sum, item) => sum + item.bounce_rate, 0) / engagementData.length).toFixed(1)
  const avgSessionDuration = data?.summary?.avgSessionDuration || Math.round(engagementData.reduce((sum, item) => sum + item.session_duration, 0) / engagementData.length)
  const avgPagesPerSession = data?.summary?.avgPagesPerSession || (engagementData.reduce((sum, item) => sum + item.pages_per_session, 0) / engagementData.length).toFixed(1)
  const avgConversionRate = data?.summary?.avgConversionRate || (engagementData.reduce((sum, item) => sum + item.conversion_rate, 0) / engagementData.length).toFixed(1)

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Engagement Metrics</h3>
          <p className="text-sm text-gray-600">
            Bounce rate, session duration, and user engagement in the last {selectedPeriod} days
            {data?.engagementData && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Real Data
              </span>
            )}
          </p>
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

      {/* Key Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        {/* Bounce Rate */}
        <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
          <div className="flex items-center gap-3 mb-3">
            <MousePointer className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-700">Bounce Rate</span>
          </div>
          <div className="text-3xl font-bold text-red-900">{avgBounceRate}%</div>
          <p className="text-sm text-red-600 mt-1">Lower is better</p>
        </div>

        {/* Session Duration */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Session Duration</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">{Math.floor(avgSessionDuration / 60)}m {avgSessionDuration % 60}s</div>
          <p className="text-sm text-blue-600 mt-1">Average per session</p>
        </div>

        {/* Pages per Session */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700">Pages/Session</span>
          </div>
          <div className="text-3xl font-bold text-green-900">{avgPagesPerSession}</div>
          <p className="text-sm text-green-600 mt-1">Higher engagement</p>
        </div>

        {/* Conversion Rate */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Conversion Rate</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">{avgConversionRate}%</div>
          <p className="text-sm text-purple-600 mt-1">Goal completions</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bounce Rate Trend */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Bounce Rate Trend</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = formatGA4Date(value)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = formatGA4Date(value)
                    return date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  }}
                  formatter={(value: number) => [`${value}%`, 'Bounce Rate']}
                />
                <Line 
                  type="monotone" 
                  dataKey="bounce_rate" 
                  stroke="#ef4444" 
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#ef4444', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Session Duration Trend */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Session Duration Trend</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={engagementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = formatGA4Date(value)
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={(value) => {
                    const date = formatGA4Date(value)
                    return date.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })
                  }}
                  formatter={(value: number) => [`${Math.floor(value / 60)}m ${value % 60}s`, 'Duration']}
                />
                <Area 
                  type="monotone" 
                  dataKey="session_duration" 
                  stroke="#3b82f6" 
                  fill="#3b82f6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Detailed Metrics Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bounce Rate</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session Duration</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pages/Session</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Conversion Rate</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {engagementData.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {formatGA4Date(item.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.bounce_rate}%</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {Math.floor(item.session_duration / 60)}m {item.session_duration % 60}s
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.pages_per_session}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.conversion_rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Engagement Insights</p>
            <p>
              Your bounce rate of {avgBounceRate}% is {parseFloat(avgBounceRate) < 50 ? 'excellent' : 'good'}, 
              with an average session duration of {Math.floor(avgSessionDuration / 60)}m {avgSessionDuration % 60}s. 
              Users view an average of {avgPagesPerSession} pages per session, indicating {parseFloat(avgPagesPerSession) > 3 ? 'strong' : 'moderate'} engagement.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
