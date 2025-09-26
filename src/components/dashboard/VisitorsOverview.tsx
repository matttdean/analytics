'use client'

import { useMemo, useState, useEffect } from 'react'
import useSWR from 'swr'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Calendar, TrendingUp, Users, AlertCircle, ChevronDown } from 'lucide-react'
import ConnectGoogle from '../ConnectGoogle'

/**
 * Safer fetcher: throws on non-2xx so SWR surface errors properly.
 */
const fetcher = async (url: string) => {
  const res = await fetch(url)
  const text = await res.text()
  if (!res.ok) {
    // Try to parse JSON but fall back to text for helpful debugging
    try {
      const data = JSON.parse(text)
      throw Object.assign(new Error(data?.error || res.statusText), { status: res.status, data })
    } catch {
      throw Object.assign(new Error(text || res.statusText), { status: res.status })
    }
  }
  return text ? JSON.parse(text) : {}
}

const timePeriods = [
  { label: '7 days', value: 7 },
  { label: '14 days', value: 14 },
  { label: '28 days', value: 28 },
  { label: '90 days', value: 90 }
]

type VisitorsOverviewProps = { property?: string }

export default function VisitorsOverview({ property }: VisitorsOverviewProps) {
  const [selectedPeriod, setSelectedPeriod] = useState(28)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [selectedProperty, setSelectedProperty] = useState<string | null>(property || null)

  // Always query connected GA4 properties for the dropdown
  const { data: connectionData, error: connectionError } = useSWR(
    '/api/google/ga4/properties',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  // Update selectedProperty when property prop changes
  useEffect(() => {
    if (property) {
      setSelectedProperty(property)
    }
  }, [property])

  /**
   * Figure out the effective property from:
   * 1) selectedProperty state, or
   * 2) API response. Different backends return different shapes; handle common ones:
   *    - { items: [{ propertyId: '123' }]}
   *    - { properties: [{ name: 'properties/123' }]}
   *    - { items: [{ property: { propertyId: '123' }}]}
   */
  const effectiveProperty = useMemo(() => {
    if (selectedProperty) return selectedProperty

    // ✅ use the saved selection even if items is empty
    const saved = connectionData?.selectedPropertyId
    if (saved) return String(saved)

    const firstItem =
      connectionData?.items?.[0] ??
      connectionData?.properties?.[0] ??
      connectionData?.items?.[0]?.property

    // Direct propertyId
    const direct = firstItem?.propertyId ?? connectionData?.propertyId
    if (direct) return String(direct)

    // GA Admin API "name": "properties/123"
    const name = firstItem?.name ?? connectionData?.name
    if (typeof name === 'string' && name.startsWith('properties/')) {
      return name.split('/')[1]
    }

    return undefined
  }, [selectedProperty, connectionData])
  
  // Real-time active users - let server resolve property from ga4_connections
  const { data: realtimeData, error: realtimeError } = useSWR(
    '/api/data/realtime',
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  // Historical overview - let server resolve property from ga4_connections
  const { data: historicalData, error: historicalError } = useSWR(
    `/api/data/overview?days=${selectedPeriod}`,
    fetcher,
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  )

  // Check for missing tokens signal from your API
  const hasMissingTokens =
    historicalData?.error === 'missing_google_tokens' ||
    realtimeData?.error === 'missing_google_tokens' ||
    connectionData?.error === 'missing_google_tokens'

  // Manual sync function
  const handleSync = async () => {
    if (isSyncing) return
    
    setIsSyncing(true)
    setSyncMessage('')
    
    try {
      const response = await fetch('/api/sync/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        setSyncMessage(`Sync failed: ${data.message || 'Unknown error'}`)
        return
      }
      
      setSyncMessage('Sync completed successfully! Refreshing data...')
      
      // Refresh the data by reloading the page
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      
    } catch (error: any) {
      setSyncMessage(`Sync error: ${error.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // Auto-sync if no recent data
  useEffect(() => {
    const shouldAutoSync = 
      !isSyncing && 
      effectiveProperty && 
      historicalData && 
      historicalData.ga4 && 
      historicalData.ga4.length === 0

    if (shouldAutoSync) {
      console.log('🔄 Auto-syncing data - no historical data found')
      handleSync()
    }
  }, [effectiveProperty, historicalData, isSyncing, handleSync])





  // If not connected, nudge to connect (don't block on property discovery)
  if (hasMissingTokens) {
    return (
      <section className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Visitors Overview</h2>
          <p className="text-gray-600">Track your website traffic and visitor engagement</p>
        </div>

        <div className="text-center py-12">
          <AlertCircle className="mx-auto h-16 w-16 text-blue-400 mb-6" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Connect Your Google Account</h3>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            To view your Google Analytics data, connect your Google account and choose a GA4 property.
          </p>
          <ConnectGoogle />
        </div>
      </section>
    )
  }

  // Surface connection errors cleanly
  if (connectionError) {
    return (
      <section className="rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Visitors Overview</h2>
        <p className="text-red-600">Error loading GA4 properties: {connectionError?.message || 'Unknown error'}</p>
      </section>
    )
  }

  // Calculate metrics from historical + realtime data safely
  const liveVisitors = realtimeData?.activeUsers ?? 0
  const totalVisitors = historicalData?.kpis?.users?.value ?? 0



  /**
   * Normalize chart data.
   * Expect either:
   * - historicalData.ga4 = [{ date: '2025-09-01', active_users: 123 }, ...]
   * - or rows like [{ date: '20250901', activeUsers: 123 }]
   */
  const chartData =
    (historicalData?.ga4 ?? historicalData?.rows ?? []).map((item: any) => {
      const rawDate: string =
        item.date ??
        item.dimensionValues?.[0]?.value ?? // GA Data API style
        item.day ??
        ''

      // Try to normalize YYYYMMDD to YYYY-MM-DD
      let isoDate = rawDate
      if (/^\d{8}$/.test(rawDate)) {
        isoDate = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
      }

      const users =
        item.active_users ??
        item.activeUsers ??
        item.metricValues?.[0]?.value ??
        item.users ??
        0

      return { date: isoDate, active_users: Number(users) || 0 }
    }) ?? []
  
  // Calculate daily average based on actual data points, not the selected period
  const actualDataPoints = chartData.length
  const dailyAverage = totalVisitors && actualDataPoints > 0 ? Math.round(totalVisitors / actualDataPoints) : 0

  return (
    <section className="rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Visitors Overview</h2>
        <p className="text-gray-600">Track your website traffic and visitor engagement</p>
      </div>

      {/* Website Selection */}
      {connectionData?.items && connectionData.items.length > 1 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Website</span>
          </div>
          <div className="relative">
            <select
              value={selectedProperty || ''}
              onChange={(e) => setSelectedProperty(e.target.value || null)}
              className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
            >
              <option value="">Select a website...</option>
              {connectionData.items.map((item: any) => {
                const propertyId = item.propertyId || item.property?.propertyId
                const displayName = item.propertyDisplayName || item.displayName || propertyId
                return (
                  <option key={propertyId} value={propertyId}>
                    {displayName}
                  </option>
                )
              })}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Time Period Selection */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="h-5 w-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Time Period</span>
          {isSyncing && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Syncing data...</span>
            </div>
          )}
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

      {/* Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-3 mb-8">
        {/* Live Visitors */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm font-medium text-green-700">Live Visitors</span>
          </div>
          <div className="text-3xl font-bold text-green-900">{liveVisitors}</div>
          <p className="text-sm text-green-600 mt-1">Currently browsing</p>
          {!effectiveProperty && (
            <p className="text-xs text-yellow-600 mt-1">No GA4 property configured</p>
          )}
          {realtimeError && (
            <p className="text-xs text-red-500 mt-1">Error loading live data: {realtimeError.message}</p>
          )}
        </div>

        {/* Total Visitors */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Total Visitors</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">{Number(totalVisitors).toLocaleString()}</div>
          <p className="text-sm text-blue-600 mt-1">Last {selectedPeriod} days</p>
          {totalVisitors === 0 && !historicalError && (
            <div className="mt-2">
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded transition-colors disabled:opacity-50"
              >
                {isSyncing ? 'Syncing...' : 'Sync Data'}
              </button>
            </div>
          )}
          {historicalError && (
            <p className="text-xs text-red-500 mt-1">Error loading historical data: {historicalError.message}</p>
          )}
        </div>

        {/* Daily Average */}
        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Daily Average</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">{Number(dailyAverage).toLocaleString()}</div>
          <p className="text-sm text-purple-600 mt-1">Visitors per day</p>

        </div>
      </div>

      {/* Sync Message */}
      {syncMessage && (
        <div className={`p-3 rounded-lg mb-4 ${
          syncMessage.includes('failed') || syncMessage.includes('error') 
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-green-50 text-green-700 border border-green-200'
        }`}>
          <p className="text-sm">{syncMessage}</p>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 ? (
        <div className="bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Visitor Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value: string) => {
                    const date = new Date(value)
                    return isNaN(date.getTime())
                      ? value
                      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value: string) => {
                    const date = new Date(value)
                    return isNaN(date.getTime())
                      ? value
                      : date.toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                  }}
                  formatter={(val: number) => [Number(val).toLocaleString(), 'Active Users']}
                />
                <Line 
                  type="monotone" 
                  dataKey="active_users" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-gray-500">No chart data available for the selected time period</p>
        </div>
      )}
    </section>
  )
}

