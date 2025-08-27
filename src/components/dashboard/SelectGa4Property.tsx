'use client'
import useSWR from 'swr'
import { useState } from 'react'

const fetcher = (u: string) => fetch(u, { cache: 'no-store' }).then(r => r.json())

export default function SelectGa4Property() {
  const { data, error, isLoading, mutate } = useSWR('/api/google/ga4/properties', fetcher)
  const [selected, setSelected] = useState<string>('')

  if (isLoading) return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="font-medium mb-2">Select a GA4 property</h3>
      <p className="text-sm text-zinc-600">Loading your properties…</p>
    </section>
  )

  if (error || data?.error) return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="font-medium mb-2">Select a GA4 property</h3>
      <p className="text-sm text-red-600">Couldn’t load properties: {data?.error || 'request failed'}</p>
      <p className="text-xs text-zinc-500 mt-2">Ensure your Google connection has the “Analytics Data/Admin API” enabled and scope <code>analytics.readonly</code>.</p>
    </section>
  )

  const items: { propertyId: string; propertyDisplayName: string; accountDisplayName: string }[] = data?.items || []

  async function save() {
    const choice = items.find(i => i.propertyId === selected)
    const res = await fetch('/api/google/ga4/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        propertyId: selected,
        propertyDisplayName: choice?.propertyDisplayName,
        accountDisplayName: choice?.accountDisplayName,
      }),
    })
    if (res.ok) {
      // refresh the page (server will see ga4_connections now)
      location.reload()
    }
  }

  return (
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <h3 className="font-medium mb-2">Select a GA4 property</h3>
      <p className="text-sm text-zinc-600 mb-4">Choose the property to use for your dashboard.</p>

      <div className="flex gap-2 items-center">
        <select
          className="min-w-[320px] rounded-md border px-3 py-2"
          value={selected}
          onChange={e => setSelected(e.target.value)}
        >
          <option value="" disabled>Pick a property…</option>
          {items.map(i => (
            <option key={i.propertyId} value={i.propertyId}>
              {i.propertyDisplayName} — {i.propertyId} ({i.accountDisplayName})
            </option>
          ))}
        </select>
        <button
          onClick={save}
          disabled={!selected}
          className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </section>
  )
}
