import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Goals & Conversions API Test Endpoint',
    status: 'working',
    timestamp: new Date().toISOString(),
    endpoints: {
      goals: '/api/data/goals-conversions',
      description: 'Fetches real goals and conversion data from GA4'
    }
  })
}
