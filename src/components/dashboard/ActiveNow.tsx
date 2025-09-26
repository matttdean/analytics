'use client'
import useSWR from 'swr'

const fetcher = (u: string) => fetch(u).then(r => r.json())

export default function ActiveNow({ property }: { property?: string }) {
  const q = property ? `/api/data/realtime?property=${property}` : '/api/data/realtime'
  const { data, error, isLoading } = useSWR(q, fetcher, { 
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })

  const val = typeof data?.activeUsers === 'number' ? data.activeUsers : 0

  return (
    <section className="rounded-2xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse"></div>
          <h3 className="text-lg font-semibold text-gray-900">Live Visitors</h3>
        </div>
        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
          Live data
        </span>
      </div>
      <div className="text-5xl font-bold text-gray-900 mb-2">
        {isLoading ? '—' : val.toLocaleString()}
      </div>
      <p className="text-sm text-gray-600 mb-4">
        People actively browsing your website right now
      </p>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs text-red-700">
            {data?.error || 'Unable to fetch live data'}
          </p>
        </div>
      )}
    </section>
  )
}
