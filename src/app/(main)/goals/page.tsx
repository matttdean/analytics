'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Target, TrendingUp, BarChart3, Funnel, CheckCircle, AlertTriangle, Clock, DollarSign, ShoppingCart, Mail, Phone, Calendar, RefreshCw } from 'lucide-react'

// TypeScript interfaces for better type safety
interface Goal {
  id: number
  name: string
  type: string
  target: number
  current: number
  conversionRate: number
  status: string
  description: string
}

interface ConversionFunnelStage {
  stage: string
  visitors: number
  conversionRate: number
  dropoff: number
}

interface ConversionInsight {
  insight: string
  impact: 'High' | 'Medium' | 'Low'
  recommendation: string
  status: string
}

interface CustomEvent {
  name: string
  count: number
  type: string
}

interface GoalsData {
  overview: {
    overallConversion: number
    overallConversionDelta: number
    goalsMet: number
    totalGoals: number
    funnelConversion: number
    revenueImpact: number
  }
  goals: Goal[]
  conversionFunnel: ConversionFunnelStage[]
  conversionInsights: ConversionInsight[]
  customEvents: CustomEvent[]
  summary: {
    totalUsers: number
    totalUsersDelta: number
    conversions: number
    conversionsDelta: number
    sessions: number
    sessionsDelta: number
    pageViews: number
    pageViewsDelta: number
    avgSessionDuration: number
    avgSessionDurationDelta: number
  }
  error?: string
}

const fetcher = (url: string) => fetch(url).then(r => r.json())

export default function GoalsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState(28)

  const timePeriods = [
    { label: '7 days', value: 7 },
    { label: '14 days', value: 14 },
    { label: '28 days', value: 28 },
    { label: '90 days', value: 90 }
  ]

  // Fetch real goals and conversions data
  const { data: goalsData, error: goalsError, isLoading: goalsLoading, mutate: refreshData } = useSWR<GoalsData>(
    `/api/data/goals-conversions?days=${selectedPeriod}`,
    fetcher,
    { 
      revalidateOnFocus: false,
      dedupingInterval: 300000 // 5 minutes
    }
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track': return 'text-green-600 bg-green-100'
      case 'at-risk': return 'text-yellow-600 bg-yellow-100'
      case 'exceeding': return 'text-blue-600 bg-blue-100'
      case 'behind': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'on-track': return <CheckCircle className="h-4 w-4" />
      case 'at-risk': return <AlertTriangle className="h-4 w-4" />
      case 'exceeding': return <TrendingUp className="h-4 w-4" />
      case 'behind': return <Clock className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100)
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  // Show loading state
  if (goalsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading goals and conversion data...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (goalsError || goalsData?.error) {
    // Check if it's a missing Google tokens error
    if (goalsData?.error === 'missing_google_tokens' || goalsData?.error === 'unauthenticated') {
      return (
        <div className="text-center py-16">
          <div className="max-w-md mx-auto">
            <Target className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Google Analytics</h3>
            <p className="text-gray-600 mb-6">
              To track goals and conversions, you need to connect your Google Analytics 4 account. This will allow us to pull real conversion data and track your business goals.
            </p>
            <a
              href="/api/google/oauth/start"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect Google Analytics
            </a>
          </div>
        </div>
      )
    }

    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">
            {goalsError?.message || goalsData?.error || 'Failed to load goals and conversion data. Please check your Google OAuth connection.'}
          </p>
          <button
            onClick={() => refreshData()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Show no data state
  if (!goalsData) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto">
          <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
          <p className="text-gray-600 mb-6">
            No goals and conversion data found. Please ensure you have Google Analytics 4 connected and conversion tracking enabled.
          </p>
          <a
            href="/api/google/oauth/start"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 mx-auto"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Connect Google Analytics
          </a>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 flex items-center justify-center">
            <Target className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Goals & Conversions</h1>
        </div>
        <p className="text-gray-600">Track your business goals and optimize conversion rates</p>
      </div>

      {/* Time Period Selection */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Time Period</span>
          </div>
          <button
            onClick={() => refreshData()}
            className="px-3 py-1 bg-gray-100 text-gray-600 rounded-md text-sm hover:bg-gray-200 transition-colors flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
        <div className="flex gap-2">
          {timePeriods.map((period) => (
            <button
              key={period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPeriod === period.value
                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conversion Overview */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="h-6 w-6 text-green-600" />
            <span className="text-sm font-medium text-green-700">Overall Conversion</span>
          </div>
          <div className="text-3xl font-bold text-green-900">
            {goalsData.overview.overallConversion.toFixed(1)}%
          </div>
          <div className={`text-sm ${goalsData.overview.overallConversionDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {goalsData.overview.overallConversionDelta >= 0 ? '+' : ''}{goalsData.overview.overallConversionDelta.toFixed(1)}% vs last period
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
          <div className="flex items-center gap-3 mb-3">
            <Target className="h-6 w-6 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Goals Met</span>
          </div>
          <div className="text-3xl font-bold text-blue-900">
            {goalsData.overview.goalsMet}/{goalsData.overview.totalGoals}
          </div>
          <div className="text-sm text-blue-600">
            {Math.round((goalsData.overview.goalsMet / goalsData.overview.totalGoals) * 100)}% completion rate
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl p-6 border border-purple-200">
          <div className="flex items-center gap-3 mb-3">
            <Funnel className="h-6 w-6 text-purple-600" />
            <span className="text-sm font-medium text-purple-700">Funnel Conversion</span>
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {goalsData.overview.funnelConversion.toFixed(1)}%
          </div>
          <div className="text-sm text-purple-600">Website to purchase</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-6 border border-orange-200">
          <div className="flex items-center gap-3 mb-3">
            <DollarSign className="h-6 w-6 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">Revenue Impact</span>
          </div>
          <div className={`text-3xl font-bold ${goalsData.overview.revenueImpact >= 0 ? 'text-orange-900' : 'text-red-900'}`}>
            {goalsData.overview.revenueImpact >= 0 ? '+' : ''}{goalsData.overview.revenueImpact.toFixed(1)}%
          </div>
          <div className="text-sm text-orange-600">vs last period</div>
        </div>
      </div>

      {/* Goals Tracking */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-5 w-5 text-emerald-600" />
          Goals Progress
        </h3>
        
        <div className="space-y-4">
          {goalsData.goals.map((goal) => (
            <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                      {goal.status.replace('-', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{goal.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">Target: {formatNumber(goal.target)}</span>
                    <span className="text-gray-600">Current: {formatNumber(goal.current)}</span>
                    <span className="text-gray-600">Rate: {goal.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900 mb-1">
                    {getProgressPercentage(goal.current, goal.target).toFixed(0)}%
                  </div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div 
                  className="bg-emerald-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${getProgressPercentage(goal.current, goal.target)}%` }}
                ></div>
              </div>
              
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-md text-sm hover:bg-emerald-200 transition-colors">
                  View Details
                </button>
                <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors">
                  Edit Goal
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Funnel className="h-5 w-5 text-blue-600" />
          Conversion Funnel
        </h3>
        
        <div className="space-y-4">
          {goalsData.conversionFunnel.map((stage, index) => (
            <div key={index} className="flex items-center gap-4">
              <div className="w-32 text-sm font-medium text-gray-700">{stage.stage}</div>
              
              <div className="flex-1 bg-gray-200 rounded-full h-8 relative">
                <div 
                  className="bg-blue-600 h-8 rounded-full transition-all duration-300 relative"
                  style={{ width: `${stage.conversionRate}%` }}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">
                      {formatNumber(stage.visitors)}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="w-20 text-right">
                <div className="text-sm font-medium text-gray-900">{stage.conversionRate.toFixed(1)}%</div>
                <div className="text-xs text-gray-500">{formatNumber(stage.visitors)}</div>
              </div>
              
              {index < goalsData.conversionFunnel.length - 1 && (
                <div className="w-16 text-center">
                  <div className="text-xs text-red-500 font-medium">
                    -{goalsData.conversionFunnel[index + 1].dropoff.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">Dropoff</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Insights */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          Conversion Insights & Recommendations
        </h3>
        
        <div className="space-y-4">
          {goalsData.conversionInsights.map((insight, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">{insight.insight}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      insight.impact === 'High' ? 'bg-red-100 text-red-700' :
                      insight.impact === 'Medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {insight.impact} Impact
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{insight.recommendation}</p>
                </div>
                
                <div className="text-right">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    insight.status === 'implemented' ? 'bg-green-100 text-green-700' :
                    insight.status === 'in-progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {insight.status.replace('-', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md text-sm hover:bg-blue-200 transition-colors">
                  Take Action
                </button>
                <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 transition-colors">
                  Learn More
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Metrics Summary */}
      <div className="bg-white rounded-2xl border shadow-sm p-6 mt-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-600" />
          Additional Metrics
        </h3>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{formatNumber(goalsData.summary.totalUsers)}</div>
            <div className="text-sm text-gray-600">Total Users</div>
            <div className={`text-xs ${goalsData.summary.totalUsersDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {goalsData.summary.totalUsersDelta >= 0 ? '+' : ''}{goalsData.summary.totalUsersDelta.toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{formatNumber(goalsData.summary.conversions)}</div>
            <div className="text-sm text-gray-600">Conversions</div>
            <div className={`text-xs ${goalsData.summary.conversionsDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {goalsData.summary.conversionsDelta >= 0 ? '+' : ''}{goalsData.summary.conversionsDelta.toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{formatNumber(goalsData.summary.sessions)}</div>
            <div className="text-sm text-gray-600">Sessions</div>
            <div className={`text-xs ${goalsData.summary.sessionsDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {goalsData.summary.sessionsDelta >= 0 ? '+' : ''}{goalsData.summary.sessionsDelta.toFixed(1)}%
            </div>
          </div>
          
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{formatDuration(goalsData.summary.avgSessionDuration)}</div>
            <div className="text-sm text-gray-600">Avg Session</div>
            <div className={`text-xs ${goalsData.summary.avgSessionDurationDelta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {goalsData.summary.avgSessionDurationDelta >= 0 ? '+' : ''}{goalsData.summary.avgSessionDurationDelta.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
