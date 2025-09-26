'use client'

import { useState } from 'react'

export default function DebugGBPPage() {
  const [results, setResults] = useState<any>({})
  const [loading, setLoading] = useState<string | null>(null)

  const testEndpoint = async (name: string, url: string, method: string = 'GET', body?: any) => {
    setLoading(name)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      })
      const data = await response.json()
      setResults(prev => ({ ...prev, [name]: { status: response.status, data } }))
    } catch (error) {
      setResults(prev => ({ ...prev, [name]: { error: error.message } }))
    } finally {
      setLoading(null)
    }
  }

  const testGBPConnect = async () => {
    const testLocation = {
      locationName: 'accounts/1234567890/locations/0987654321',
      locationTitle: 'Test Business Location'
    }
    await testEndpoint('gbp-connect', '/api/google/gbp/connect', 'POST', testLocation)
  }

  const testBusinessProfile = async () => {
    await testEndpoint('business-profile', '/api/data/business-profile')
  }

  const testBusinessProfileWithLocation = async () => {
    await testEndpoint('business-profile-override', '/api/data/business-profile?location=accounts/1234567890/locations/0987654321')
  }

  const testGBPConnections = async () => {
    await testEndpoint('gbp-connections', '/api/debug/test-gbp-connection')
  }

  const testGBPTokens = async () => {
    await testEndpoint('gbp-tokens', '/api/debug/gbp-test')
  }

  const createTestLocation = async () => {
    await testEndpoint('create-test-location', '/api/debug/create-test-location', 'POST')
  }

  const testRealLocation = async () => {
    await testEndpoint('test-real-location', '/api/debug/test-real-location')
  }

  const syncGBPData = async () => {
    await testEndpoint('sync-gbp', '/api/debug/sync-gbp', 'POST')
  }

  const checkGBPData = async () => {
    await testEndpoint('check-gbp-data', '/api/debug/sync-gbp')
  }

  const createGBPTables = async () => {
    await testEndpoint('create-gbp-tables', '/api/debug/create-gbp-tables', 'POST')
  }

  const checkGBPTables = async () => {
    await testEndpoint('check-gbp-tables', '/api/debug/create-gbp-tables')
  }

  const testBusinessProfileAPI = async () => {
    await testEndpoint('business-profile-api', '/api/data/business-profile')
  }

  const clearGBPConnection = async () => {
    await testEndpoint('clear-gbp-connection', '/api/debug/clear-gbp-connection', 'DELETE')
  }

  const checkGBPConnection = async () => {
    await testEndpoint('check-gbp-connection', '/api/debug/clear-gbp-connection')
  }

  const clearResults = () => {
    setResults({})
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">GBP Debug Page</h1>
      
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Test Endpoints</h2>
          <button 
            onClick={clearResults}
            className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <button 
            onClick={() => testEndpoint('gbp-accounts', '/api/google/gbp/accounts')}
            disabled={loading === 'gbp-accounts'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-accounts' ? 'Loading...' : 'Test GBP Accounts'}
          </button>
          
          <button 
            onClick={testGBPConnect}
            disabled={loading === 'gbp-connect'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-connect' ? 'Connecting...' : 'Test GBP Connect'}
          </button>
          
          <button 
            onClick={testBusinessProfile}
            disabled={loading === 'business-profile'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'business-profile' ? 'Loading...' : 'Test Business Profile'}
          </button>
          
          <button 
            onClick={testBusinessProfileWithLocation}
            disabled={loading === 'business-profile-override'}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'business-profile-override' ? 'Loading...' : 'Test Business Profile (Override)'}
          </button>
          
          <button 
            onClick={testGBPConnections}
            disabled={loading === 'gbp-connections'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-connections' ? 'Loading...' : 'Check GBP Connections'}
          </button>
          
          <button 
            onClick={testGBPTokens}
            disabled={loading === 'gbp-tokens'}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-tokens' ? 'Loading...' : 'Test GBP Tokens'}
          </button>
          
          <button 
            onClick={createTestLocation}
            disabled={loading === 'create-test-location'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'create-test-location' ? 'Creating...' : 'Create Test Location'}
          </button>
          
          <button 
            onClick={testRealLocation}
            disabled={loading === 'test-real-location'}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-real-location' ? 'Testing...' : 'Test Real Location API'}
          </button>
          
          <button 
            onClick={syncGBPData}
            disabled={loading === 'sync-gbp'}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'sync-gbp' ? 'Syncing...' : 'Sync GBP Data to Supabase'}
          </button>
          
          <button 
            onClick={checkGBPData}
            disabled={loading === 'check-gbp-data'}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'check-gbp-data' ? 'Checking...' : 'Check Stored GBP Data'}
          </button>
          
          <button 
            onClick={createGBPTables}
            disabled={loading === 'create-gbp-tables'}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'create-gbp-tables' ? 'Creating...' : 'Create GBP Tables'}
          </button>
          
          <button 
            onClick={checkGBPTables}
            disabled={loading === 'check-gbp-tables'}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'check-gbp-tables' ? 'Checking...' : 'Check GBP Tables'}
          </button>
          
          <button 
            onClick={testBusinessProfileAPI}
            disabled={loading === 'business-profile-api'}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'business-profile-api' ? 'Testing...' : 'Test Business Profile API'}
          </button>
          
          <button 
            onClick={clearGBPConnection}
            disabled={loading === 'clear-gbp-connection'}
            className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'clear-gbp-connection' ? 'Clearing...' : 'Clear GBP Connection'}
          </button>
          
          <button 
            onClick={checkGBPConnection}
            disabled={loading === 'check-gbp-connection'}
            className="px-4 py-2 bg-lime-600 text-white rounded-lg hover:bg-lime-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'check-gbp-connection' ? 'Checking...' : 'Check GBP Connection'}
          </button>
          
          <button 
            onClick={() => testEndpoint('gbp-detailed', '/api/debug/gbp-detailed')}
            disabled={loading === 'gbp-detailed'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-detailed' ? 'Testing...' : 'Test GBP Detailed'}
          </button>
          
          <button 
            onClick={() => testEndpoint('gbp-permissions', '/api/debug/gbp-permissions')}
            disabled={loading === 'gbp-permissions'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'gbp-permissions' ? 'Testing...' : 'Test GBP Permissions'}
          </button>
          
          <button 
            onClick={() => testEndpoint('oauth-scopes', '/api/debug/oauth-scopes')}
            disabled={loading === 'oauth-scopes'}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'oauth-scopes' ? 'Testing...' : 'Check OAuth Scopes'}
          </button>
          
          <button 
            onClick={() => testEndpoint('curl-command', '/api/debug/curl-command')}
            disabled={loading === 'curl-command'}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'curl-command' ? 'Testing...' : 'Get Curl Command'}
          </button>
          
          <button 
            onClick={() => testEndpoint('refresh-token', '/api/debug/refresh-token')}
            disabled={loading === 'refresh-token'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'refresh-token' ? 'Refreshing...' : 'Force Refresh Token'}
          </button>
          
          <button 
            onClick={() => testEndpoint('connect-real-location', '/api/debug/connect-real-location', 'POST')}
            disabled={loading === 'connect-real-location'}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'connect-real-location' ? 'Connecting...' : 'Connect Real Location'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-gbp-token', '/api/debug/test-gbp-token')}
            disabled={loading === 'test-gbp-token'}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-gbp-token' ? 'Testing...' : 'Test GBP Token'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-business-info', '/api/debug/test-business-info')}
            disabled={loading === 'test-business-info'}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-business-info' ? 'Testing...' : 'Test Business Info'}
          </button>
          
          <button 
            onClick={() => testEndpoint('fetch-all-gbp-data', '/api/debug/fetch-all-gbp-data')}
            disabled={loading === 'fetch-all-gbp-data'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'fetch-all-gbp-data' ? 'Fetching...' : 'Fetch All GBP Data'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-business-info-simple', '/api/debug/test-business-info-simple')}
            disabled={loading === 'test-business-info-simple'}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-business-info-simple' ? 'Testing...' : 'Test Business Info Simple'}
          </button>
          
          <button 
            onClick={() => testEndpoint('check-gbp-connection', '/api/debug/check-gbp-connection')}
            disabled={loading === 'check-gbp-connection'}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'check-gbp-connection' ? 'Checking...' : 'Check GBP Connection'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-performance-api', '/api/debug/test-performance-api')}
            disabled={loading === 'test-performance-api'}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-performance-api' ? 'Testing...' : 'Test Performance API'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-performance-curl', '/api/debug/test-performance-curl')}
            disabled={loading === 'test-performance-curl'}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-performance-curl' ? 'Testing...' : 'Test Performance cURL'}
          </button>
          
          <button 
            onClick={() => testEndpoint('test-gbp-comprehensive', '/api/debug/test-gbp-comprehensive')}
            disabled={loading === 'test-gbp-comprehensive'}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'test-gbp-comprehensive' ? 'Testing...' : 'Test GBP Comprehensive'}
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(results).map(([name, result]) => (
            <div key={name} className="border rounded-lg p-4">
              <h3 className="font-semibold text-lg mb-2">{name}</h3>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
