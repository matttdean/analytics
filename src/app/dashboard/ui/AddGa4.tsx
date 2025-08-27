'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'


export default function AddGa4() {
const [propertyId, setPropertyId] = useState('properties/123456789')
const r = useRouter()
async function save() {
const res = await fetch('/api/connections/ga4', { method: 'POST', body: JSON.stringify({ propertyId }) })
if (res.ok) r.refresh()
}
return (
<div className="flex gap-2">
<input className="border rounded-lg px-3 py-2" value={propertyId} onChange={e=>setPropertyId(e.target.value)} />
<button onClick={save} className="px-4 py-2 rounded-lg bg-black text-white">Add GA4</button>
</div>
)
}