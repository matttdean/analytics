'use client'

import { useState } from 'react'

interface ConnectGoogleProps {
  onConnected?: () => void
}

export default function ConnectGoogle({ onConnected }: ConnectGoogleProps = {}) {
  const [loading, setLoading] = useState(false)
  
  const onClick = async () => {
    setLoading(true)
    window.location.href = '/api/google/oauth/start'
  }
  
  return (
    <button 
      onClick={onClick} 
      disabled={loading} 
      className="px-4 py-2 rounded-xl bg-black text-white hover:bg-gray-800 transition-colors"
    >
      {loading ? 'Redirecting…' : 'Connect Google'}
    </button>
  )
}