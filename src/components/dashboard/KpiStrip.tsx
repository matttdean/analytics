'use client'
import useSWR from 'swr'
import KpiRadial from './KpiRadial'

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) {
    // Surface error to SWR so we render skeleton instead of crashing
    throw new Error(`${res.status} ${res.statusText}`)
  }
  return res.json()
}

export default function KpiStrip() {
  const { data, error } = useSWR('/api/data/overview?days=28', fetcher, {
    revalidateOnFocus: false,
  })

  // No data or an error? Show skeleton KPIs.
  if (error || !data || !data.kpis) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        <KpiRadial label="Users (7d)" loading />
        <KpiRadial label="CTR (28d)" loading color="blue" />
        <KpiRadial label="GBP Interactions (7d)" loading color="amber" />
      </div>
    )
  }

  const usersDelta = Number(data.kpis?.users?.delta ?? 0)
  const usersValue = Number(data.kpis?.users?.value ?? 0)

  const ctrValue = Number(data.kpis?.ctr?.value ?? 0)

  const interactionsDelta = Number(data.kpis?.interactions?.delta ?? 0)
  const interactionsValue = Number(data.kpis?.interactions?.value ?? 0)

  const clamp = (n: number) => Math.min(Math.max(n, 0), 100)

  const usersPct = clamp(Math.abs(usersDelta))
  const ctrPct = clamp(ctrValue) // CTR already 0–100
  const interPct = clamp(Math.abs(interactionsDelta))

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <KpiRadial
        label="Users (7d)"
        percent={usersPct}
        color="pink"
        value={Intl.NumberFormat().format(Math.round(usersValue))}
        delta={usersDelta}
      />
      <KpiRadial
        label="CTR (28d)"
        percent={ctrPct}
        color="blue"
        value={`${ctrValue.toFixed(1)}%`}
      />
      <KpiRadial
        label="GBP Interactions (7d)"
        percent={interPct}
        color="amber"
        value={Intl.NumberFormat().format(Math.round(interactionsValue))}
        delta={interactionsDelta}
      />
    </div>
  )
}
