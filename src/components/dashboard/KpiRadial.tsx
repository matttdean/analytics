'use client'
import { RadialBar, RadialBarChart, ResponsiveContainer, PolarAngleAxis } from 'recharts'

type Props = {
  label: string
  percent?: number        // 0–100
  color?: 'blue' | 'amber' | 'pink'
  value?: string          // e.g., "3,214" or "4.8%"
  delta?: number          // +/- percent (e.g., 12.3)
  loading?: boolean
}

const COLORS = { blue: '#3b82f6', amber: '#f59e0b', pink: '#ec4899' }

export default function KpiRadial({ label, percent = 0, color = 'pink', value, delta, loading }: Props) {
  const pct = Math.max(0, Math.min(100, percent))
  const data = [{ name: 'progress', value: pct, fill: COLORS[color] }]
  const d = Number(delta ?? 0)
  const deltaText = isFinite(d) && d !== 0 ? `${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%` : '—'

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart data={data} innerRadius="80%" outerRadius="100%" startAngle={90} endAngle={-270}>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={50} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm text-zinc-500">{label}</div>
        <div className="text-sm text-zinc-500">{loading ? '…' : `${pct.toFixed(0)}%`}</div>
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-lg font-semibold">{loading ? '—' : value ?? '—'}</div>
        <div className={`text-xs ${d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-600' : 'text-zinc-500'}`}>
          {loading ? '' : deltaText}
        </div>
      </div>
    </div>
  )
}
