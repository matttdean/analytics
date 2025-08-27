'use client'
import useSWR from 'swr'
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'


const fetcher = (url: string) => fetch(url).then(r => r.json())


export default function OverviewCharts() {
const { data } = useSWR('/api/data/overview?days=28', fetcher)
if (!data) return <div className="p-6">Loading…</div>


return (
<div className="grid md:grid-cols-2 gap-6">
<div className="rounded-xl border p-4">
<h3 className="font-medium mb-2">GA4 — Users vs Sessions (last 28d)</h3>
<div className="h-64">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={data.ga4}>
<CartesianGrid strokeDasharray="3 3" />
<XAxis dataKey="date" hide />
<YAxis />
<Tooltip />
<Legend />
<Line type="monotone" dataKey="active_users" dot={false} />
<Line type="monotone" dataKey="sessions" dot={false} />
</LineChart>
</ResponsiveContainer>
</div>
</div>


<div className="rounded-xl border p-4">
<h3 className="font-medium mb-2">Search Console — Clicks vs Impressions</h3>
<div className="h-64">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={data.gsc}>
<CartesianGrid strokeDasharray="3 3" />
<XAxis dataKey="date" hide />
<YAxis />
<Tooltip />
<Legend />
<Line type="monotone" dataKey="clicks" dot={false} />
<Line type="monotone" dataKey="impressions" dot={false} />
</LineChart>
</ResponsiveContainer>
</div>
</div>


<div className="rounded-xl border p-4 md:col-span-2">
<h3 className="font-medium mb-2">Google Business Profile — Interactions</h3>
<div className="h-64">
<ResponsiveContainer width="100%" height="100%">
<LineChart data={data.gbp}>
<CartesianGrid strokeDasharray="3 3" />
<XAxis dataKey="date" hide />
<YAxis />
<Tooltip />
<Legend />
<Line type="monotone" dataKey="website_clicks" dot={false} />
<Line type="monotone" dataKey="calls" dot={false} />
<Line type="monotone" dataKey="directions" dot={false} />
</LineChart>
</ResponsiveContainer>
</div>
</div>
</div>
)
}