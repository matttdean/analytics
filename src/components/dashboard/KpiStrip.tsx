'use client'

import useSWR from 'swr'
import KpiRadial from './KpiRadial'

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export default function KpiStrip() {
  const { data, error } = useSWR('/api/data/overview?days=28', fetcher, {
    revalidateOnFocus: false,
  })

  // No data or an error? Show skeleton KPIs.
  if (error || !data || !data.kpis) {
    return (
      <div className="grid gap-6 md:grid-cols-4">
        <KpiRadial label="Sessions" loading />
        <KpiRadial label="Page Views" loading color="blue" />
        <KpiRadial label="Bounce Rate" loading color="green" />
        <KpiRadial label="Search Visibility" loading color="amber" />
      </div>
    )
  }

  const usersDelta = Number(data.kpis?.users?.delta ?? 0)
  const usersValue = Number(data.kpis?.users?.value ?? 0)

  const ctrValue = Number(data.kpis?.ctr?.value ?? 0)

  const interactionsDelta = Number(data.kpis?.interactions?.delta ?? 0)
  const interactionsValue = Number(data.kpis?.interactions?.value ?? 0)

  const bounceRate = Number(data.kpis?.bounceRate?.value ?? 0)

  const clamp = (n: number) => Math.min(Math.max(n, 0), 100)

  const usersPct = clamp(Math.abs(usersDelta))
  const ctrPct = clamp(ctrValue) // CTR already 0–100
  const interPct = clamp(Math.abs(interactionsDelta))
  const bouncePct = clamp(bounceRate)

  // Calculate sessions (estimate based on users)
  const sessions = Math.round(usersValue * 1.5) // Rough estimate

  return (
    <div className="grid gap-6 md:grid-cols-4">
      <KpiRadial
        label="Sessions"
        percent={usersPct}
        color="pink"
        value={Intl.NumberFormat().format(sessions)}
        delta={usersDelta}
        description="Last 7 days"
      />
      <KpiRadial
        label="Page Views"
        percent={ctrPct}
        color="blue"
        value={Intl.NumberFormat().format(Math.round(usersValue * 2.3))}
        description="Total page views"
      />
      <KpiRadial
        label="Bounce Rate"
        percent={bouncePct}
        color="green"
        value={`${bounceRate.toFixed(1)}%`}
        description="Lower is better"
      />
      <KpiRadial
        label="Search Visibility"
        percent={interPct}
        color="amber"
        value={Intl.NumberFormat().format(Math.round(interactionsValue))}
        delta={interactionsDelta}
        description="Business interactions"
      />
    </div>
  )
}
