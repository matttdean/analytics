'use client'
import { useState } from 'react'

export default function DebugPage() {
  const [tokenStatus, setTokenStatus] = useState<any>(null)
  const [envStatus, setEnvStatus] = useState<any>(null)
  const [businessProfileStatus, setBusinessProfileStatus] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google/debug/token')
      const data = await res.json()
      setTokenStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const refreshToken = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google/debug/refresh')
      const data = await res.json()
      setTokenStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const checkEnv = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug/env')
      const data = await res.json()
      setEnvStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const checkBusinessProfile = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/data/business-profile')
      const data = await res.json()
      setBusinessProfileStatus(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const clearTokens = async () => {
    if (!confirm('This will delete your Google tokens and you will need to reconnect. Continue?')) {
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google/debug/clear-tokens', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setTokenStatus(null)
        alert('Tokens cleared successfully. Please reconnect your Google account.')
      } else {
        setError(data.error || 'Failed to clear tokens')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const clearSearchConsoleTokens = async () => {
    if (!confirm('This will delete your Search Console connection and you will need to reconnect. Continue?')) {
      return
    }
    
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/google/debug/clear-gsc-tokens', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert('Search Console tokens cleared successfully. Please reconnect your Search Console.')
      } else {
        setError(data.error || 'Failed to clear Search Console tokens')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const checkTableSchema = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/debug/table-schema')
      const data = await res.json()
      if (data.success) {
        alert(`Table columns: ${data.columns.join(', ')}`)
      } else {
        setError(data.error || 'Failed to check table schema')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const triggerSync = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/sync/manual', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(`Sync successful: ${data.message}`)
        // Refresh the page to show updated data
        window.location.reload()
      } else {
        setError(data.error || 'Failed to sync data')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Google Token Debug</h1>
        
        <div className="space-y-6">
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={checkEnv}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Environment'}
            </button>
            
            <button
              onClick={checkToken}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Token Status'}
            </button>
            
            <button
              onClick={refreshToken}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh Token'}
            </button>
            
            <button
              onClick={checkBusinessProfile}
              disabled={loading}
              className="px-4 py-2 bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Test Business Profile API'}
            </button>
            
            <button
              onClick={clearTokens}
              disabled={loading}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {loading ? 'Clearing...' : 'Clear All Tokens'}
            </button>
            
                         <button
               onClick={clearSearchConsoleTokens}
               disabled={loading}
               className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
             >
               {loading ? 'Clearing...' : 'Clear Search Console Only'}
             </button>
             
             <button
               onClick={async () => {
                 if (!confirm('This will reconnect your Search Console site. Continue?')) {
                   return
                 }
                 setLoading(true)
                 setError(null)
                 try {
                   const res = await fetch('/api/google/gsc/connect', { 
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ siteUrl: 'sc-domain:deandesign.co' })
                   })
                   const data = await res.json()
                   if (data.success) {
                     alert('Search Console site reconnected successfully!')
                     window.location.reload()
                   } else {
                     setError(data.error || 'Failed to reconnect Search Console site')
                   }
                 } catch (e) {
                   setError(e instanceof Error ? e.message : 'Unknown error')
                 } finally {
                   setLoading(false)
                 }
               }}
               disabled={loading}
               className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
             >
               {loading ? 'Reconnecting...' : 'Reconnect Search Console'}
             </button>
             
             <button
               onClick={async () => {
                 setLoading(true)
                 setError(null)
                 try {
                   const res = await fetch('/api/google/gsc/sites')
                   const data = await res.json()
                   if (data.error) {
                     setError(`GSC Sites Error: ${data.error}`)
                   } else {
                     alert(`GSC Sites: ${JSON.stringify(data, null, 2)}`)
                   }
                 } catch (e) {
                   setError(e instanceof Error ? e.message : 'Failed to check GSC sites')
                 } finally {
                   setLoading(false)
                 }
               }}
               disabled={loading}
               className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
             >
               {loading ? 'Checking...' : 'Check GSC Sites'}
             </button>
            
            <button
              onClick={checkTableSchema}
              disabled={loading}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Table Schema'}
            </button>
            
            <button
              onClick={triggerSync}
              disabled={loading}
              className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Syncing...' : 'Sync GA4 Data'}
            </button>
          </div>

          {error && (
            <div className="p-4 bg-red-100 border border-red-300 rounded-lg">
              <h3 className="font-semibold text-red-800">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {businessProfileStatus && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Business Profile API Status</h2>
              
              {businessProfileStatus.error ? (
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-red-800 mb-2">API Error: {businessProfileStatus.error}</h3>
                    {businessProfileStatus.message && (
                      <p className="text-red-700 mb-2">{businessProfileStatus.message}</p>
                    )}
                    {businessProfileStatus.debug && (
                      <div className="mt-3">
                        <h4 className="font-medium text-red-800 mb-2">Debug Information:</h4>
                        <div className="bg-red-100 p-3 rounded text-sm">
                          <p><strong>OAuth Scopes:</strong> {businessProfileStatus.debug.scopes}</p>
                          <p><strong>API Endpoints Tried:</strong> {businessProfileStatus.debug.endpoints?.join(', ')}</p>
                          <p><strong>Response Status:</strong> {businessProfileStatus.debug.responseStatus}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {businessProfileStatus.error === 'permission_denied' && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-2">🔒 Permission Denied - Here's how to fix it:</h4>
                      <div className="text-sm text-yellow-800 space-y-2">
                        <p><strong>1. Enable APIs in Google Cloud Console:</strong></p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline">Google Cloud Console</a></li>
                          <li>Enable "Google My Business Business Information API"</li>
                          <li>Enable "Google My Business Account Management API"</li>
                        </ul>
                        <p><strong>2. Update OAuth Scopes:</strong></p>
                        <ul className="list-disc list-inside ml-4 space-y-1">
                          <li>Add <code className="bg-yellow-100 px-1 rounded">https://www.googleapis.com/auth/plus.business.manage</code></li>
                          <li>Add <code className="bg-yellow-100 px-1 rounded">https://www.googleapis.com/auth/business.manage</code></li>
                        </ul>
                        <p><strong>3. Re-authenticate:</strong> Clear tokens and reconnect your Google account</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h3 className="font-semibold text-green-800 mb-2">✅ Business Profile API Working!</h3>
                    <p className="text-green-700">The API successfully connected to Google Business Profile.</p>
                  </div>
                  
                  {businessProfileStatus.business && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Business Information:</h4>
                      <div className="bg-gray-50 p-3 rounded text-sm">
                        <p><strong>Name:</strong> {businessProfileStatus.business.name}</p>
                        <p><strong>Status:</strong> {businessProfileStatus.business.status}</p>
                        <p><strong>Category:</strong> {businessProfileStatus.business.category}</p>
                      </div>
                    </div>
                  )}
                  
                  {businessProfileStatus.mock && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                      <p className="text-blue-800"><strong>Note:</strong> This is showing mock data. Check the error details above to see why real data isn't loading.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Search Console Status Section */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Search Console Status</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Search Console Connection</h3>
                  <p className="text-sm text-gray-600">Check your current Search Console connection status</p>
                </div>
                <button
                  onClick={async () => {
                    setLoading(true)
                    try {
                      const res = await fetch('/api/google/gsc/sites')
                      const data = await res.json()
                      if (data.error) {
                        setError(`Search Console Error: ${data.error}`)
                      } else {
                        alert(`Search Console Status: ${data.length || 0} sites connected`)
                      }
                    } catch (e) {
                      setError(e instanceof Error ? e.message : 'Failed to check Search Console')
                    } finally {
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                >
                  {loading ? 'Checking...' : 'Check GSC Status'}
                </button>
              </div>
              
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Quick Actions:</h4>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    • <strong>Check GSC Status:</strong> Verify your Search Console connection
                  </p>
                  <p className="text-sm text-gray-600">
                    • <strong>Clear Search Console Only:</strong> Remove GSC connections while keeping other Google services
                  </p>
                  <p className="text-sm text-gray-600">
                    • <strong>Clear All Tokens:</strong> Remove all Google connections (requires full reconnection)
                  </p>
                </div>
              </div>
            </div>
          </div>

          {tokenStatus && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Token Status</h2>
              
              {tokenStatus.error ? (
                <div className="space-y-2">
                  <p className="text-red-600 font-medium">Error: {tokenStatus.error}</p>
                  {tokenStatus.message && (
                    <p className="text-gray-600">{tokenStatus.message}</p>
                  )}
                  {tokenStatus.detail && (
                    <p className="text-sm text-gray-500">{tokenStatus.detail}</p>
                  )}
                  {tokenStatus.missingFields && (
                    <div>
                      <p className="text-sm text-gray-600">Missing fields:</p>
                      <ul className="list-disc list-inside text-sm text-gray-500">
                        {tokenStatus.missingFields.map((field: string) => (
                          <li key={field}>{field}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="font-medium">Token Valid:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        tokenStatus.tokenValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {tokenStatus.tokenValid ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Token Expired:</span>
                      <span className={`ml-2 px-2 py-1 rounded text-sm ${
                        tokenStatus.tokenExpired ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {tokenStatus.tokenExpired ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="font-medium">Local Expiry:</span>
                    <span className="ml-2 text-gray-600">{tokenStatus.localExpiry}</span>
                  </div>
                  
                  <div>
                    <span className="font-medium">Token Preview:</span>
                    <span className="ml-2 font-mono text-gray-600">{tokenStatus.tokenPreview}</span>
                  </div>
                  
                  {tokenStatus.scopes && (
                    <div>
                      <span className="font-medium">Scopes:</span>
                      <ul className="mt-1 list-disc list-inside text-sm text-gray-600">
                        {tokenStatus.scopes.map((scope: string) => (
                          <li key={scope}>{scope}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {tokenStatus.tokenInfo && (
                    <div>
                      <span className="font-medium">Google Token Info:</span>
                      <pre className="mt-1 p-2 bg-gray-100 rounded text-sm overflow-x-auto">
                        {JSON.stringify(tokenStatus.tokenInfo, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {tokenStatus.googleError && (
                    <div>
                      <span className="font-medium text-red-600">Google Error:</span>
                      <pre className="mt-1 p-2 bg-red-50 rounded text-sm overflow-x-auto">
                        {JSON.stringify(tokenStatus.googleError, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {envStatus && (
            <div className="bg-white border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
              
              {envStatus.hasAllRequiredVars ? (
                <div className="space-y-2">
                  <p className="text-green-600 font-medium">✅ All required environment variables are set</p>
                  <div className="text-sm text-gray-600">
                    <p><strong>GOOGLE_CLIENT_ID:</strong> {envStatus.vars.GOOGLE_CLIENT_ID}</p>
                    <p><strong>GOOGLE_CLIENT_SECRET:</strong> {envStatus.vars.GOOGLE_CLIENT_SECRET}</p>
                    <p><strong>GOOGLE_REDIRECT_URI:</strong> {envStatus.vars.GOOGLE_REDIRECT_URI}</p>
                    <p><strong>ENCRYPTION_KEY_BASE64:</strong> {envStatus.vars.ENCRYPTION_KEY_BASE64}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-red-600 font-medium">❌ Missing required environment variables:</p>
                  <ul className="list-disc list-inside text-sm text-gray-600">
                    {envStatus.missingVars.map((varName: string) => (
                      <li key={varName}>{varName}</li>
                    ))}
                  </ul>
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      <strong>To fix:</strong> Create a <code>.env.local</code> file in your project root with these variables.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
