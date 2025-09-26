'use client'

import { TrendingUp, TrendingDown, Users, Target, AlertCircle, CheckCircle, Globe, Smartphone } from 'lucide-react'

interface Insight {
  type: 'positive' | 'negative' | 'neutral'
  title: string
  description: string
  action?: string
  icon: React.ReactNode
}

export default function ClientInsights() {
  // This would be calculated based on actual data
  const insights: Insight[] = [
    {
      type: 'positive',
      title: 'Traffic Growth',
      description: 'Your website traffic increased by 23% this month compared to last month.',
      action: 'Consider adding more content to maintain this momentum.',
      icon: <TrendingUp className="h-5 w-5 text-green-600" />
    },
    {
      type: 'neutral',
      title: 'Mobile Performance',
      description: '68% of your visitors are on mobile devices, but your mobile bounce rate is 52%.',
      action: 'Optimize your mobile experience to reduce bounce rate.',
      icon: <Smartphone className="h-5 w-5 text-blue-600" />
    },
    {
      type: 'positive',
      title: 'Page Load Speed',
      description: 'Your website loads in 2.3 seconds, which is faster than 75% of websites.',
      action: 'Continue monitoring and optimizing for speed.',
      icon: <Globe className="h-5 w-5 text-green-600" />
    }
  ]

  const getInsightStyles = (type: string) => {
    switch (type) {
      case 'positive':
        return 'border-green-200 bg-green-50'
      case 'negative':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-8 shadow-sm">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Website Performance Insights</h3>
        <p className="text-gray-600">Data-driven recommendations to improve your website performance</p>
      </div>
      
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div key={index} className={`rounded-xl border p-4 ${getInsightStyles(insight.type)}`}>
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {insight.icon}
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                <p className="text-sm text-gray-700 mb-2">{insight.description}</p>
                {insight.action && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <p className="text-sm font-medium text-gray-800">{insight.action}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-xl">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <h4 className="font-semibold text-gray-900">Pro Tip</h4>
        </div>
        <p className="text-sm text-gray-700">
          Monitor these insights regularly and take action on recommendations to continuously improve your website's performance and user experience.
        </p>
      </div>
    </section>
  )
}
