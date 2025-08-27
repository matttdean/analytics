'use client'
import { useState } from 'react'


export default function ConnectGoogle() {
const [loading, setLoading] = useState(false)
const onClick = async () => {
setLoading(true)
const res = await fetch('/api/google/oauth/url')
const { url } = await res.json()
window.location.href = url
}
return (
<button onClick={onClick} disabled={loading} className="px-4 py-2 rounded-xl bg-black text-white">
{loading ? 'Redirecting…' : 'Connect Google'}
</button>
)
}