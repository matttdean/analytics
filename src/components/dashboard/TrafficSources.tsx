'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Globe, TrendingUp, AlertCircle } from 'lucide-react'
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

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export default function TrafficSources() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart')
  
  const { data, error, isLoading } = useSWR(
    `/api/data/traffic-sources?days=${selectedPeriod}`,
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
              <Globe className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Traffic Sources</h3>
              <p className="text-sm text-gray-600">Where your visitors are coming from</p>
            </div>
          </div>
        </div>

        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-blue-400 mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">Connect Your Google Account</h4>
          <p className="text-gray-600 mb-6">
            To view your traffic source data, you need to connect your Google account first.
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
          <Globe className="mx-auto h-8 w-8 mb-2 text-gray-400" />
          <p>Failed to load traffic sources</p>
        </div>
      </div>
    )
  }

  // Use real data if available, otherwise fallback to mock data
  const trafficSources = data?.trafficSources || [
    { source: 'Organic Search', sessions: 1250, percentage: 45, trend: '+12%' },
    { source: 'Direct', sessions: 890, percentage: 32, trend: '+5%' },
    { source: 'Social Media', sessions: 420, percentage: 15, trend: '+18%' },
    { source: 'Referral', sessions: 180, percentage: 6, trend: '-3%' },
    { source: 'Email', sessions: 90, percentage: 2, trend: '+8%' }
  ]

  const totalSessions = data?.totalSessions || trafficSources.reduce((sum, item) => sum + item.sessions, 0)

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Traffic Sources</h3>
          <p className="text-sm text-gray-600">
            Where your visitors are coming from in the last {selectedPeriod} days
            {data?.trafficSources && (
              <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Real Data
              </span>
            )}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
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
          
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'chart'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Chart
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                viewMode === 'table'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'chart' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar Chart */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Sessions by Source</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficSources}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), 'Sessions']}
                  />
                  <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Traffic Distribution</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={trafficSources}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ source, percentage }) => `${source}: ${percentage}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="percentage"
                  >
                    {trafficSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`${value}%`, 'Percentage']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sessions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Percentage</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trend</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trafficSources.map((source, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{source.source}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{source.sessions.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{source.percentage}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${
                      source.trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {source.trend}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-900">{totalSessions.toLocaleString()}</div>
          <div className="text-sm text-blue-600">Total Sessions</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-900">45%</div>
          <div className="text-sm text-green-600">Organic Search</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-900">+12%</div>
          <div className="text-sm text-purple-600">Overall Growth</div>
        </div>
      </div>
    </div>
  )
}
