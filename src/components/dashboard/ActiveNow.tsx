'use client'
import useSWR from 'swr'

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json())

export default function ActiveNow({ property }: { property?: string }) {
  const q = property ? `/api/data/realtime?property=${property}` : '/api/data/realtime'
  const { data, error, isLoading } = useSWR(q, fetcher, { refreshInterval: 30_000 })

  const val = typeof data?.activeUsers === 'number' ? data.activeUsers : 0

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">Active Users (last 30 min)</h3>
        <span className="text-xs text-zinc-500">
          updates every 30s
        </span>
      </div>
      <div className="mt-3 text-4xl font-semibold tracking-tight">
        {isLoading ? '—' : val}
      </div>
      {error && (
        <p className="mt-2 text-xs text-red-600">
          {data?.error || 'Realtime request failed'}
        </p>
      )}
    </section>
  )
}
