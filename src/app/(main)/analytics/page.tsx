import { Suspense } from 'react'
import VisitorsOverview from '../../../components/dashboard/VisitorsOverview'
import TopPages from '../../../components/dashboard/TopPages'
import TrafficSources from '../../../components/dashboard/TrafficSources'
import DeviceAnalytics from '../../../components/dashboard/DeviceAnalytics'
import EngagementMetrics from '../../../components/dashboard/EngagementMetrics'

export default function Analytics() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-gray-600">Comprehensive analytics and performance metrics</p>
      </div>

      <div className="space-y-8">
        <Suspense fallback={<div>Loading...</div>}>
          <VisitorsOverview />
        </Suspense>
        
        <Suspense fallback={<div>Loading...</div>}>
          <TrafficSources />
        </Suspense>

        <Suspense fallback={<div>Loading...</div>}>
          <DeviceAnalytics />
        </Suspense>

        <Suspense fallback={<div>Loading...</div>}>
          <EngagementMetrics />
        </Suspense>
        
        <Suspense fallback={<div>Loading...</div>}>
          <TopPages />
        </Suspense>
      </div>
    </>
  )
}
