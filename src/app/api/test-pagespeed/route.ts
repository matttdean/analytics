import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_API_KEY
    const testUrl = 'https://deandesign.co'
    
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'No Google API key found',
        message: 'Add GOOGLE_API_KEY to your .env.local file',
        testUrl 
      })
    }

    console.log('Testing PageSpeed Insights API with key:', apiKey.substring(0, 10) + '...')
    
    const response = await fetch(
      `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?key=${apiKey}&url=${encodeURIComponent(testUrl)}&strategy=mobile&category=performance`
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('PageSpeed Insights test failed:', response.status, errorText)
      return NextResponse.json({ 
        error: 'PageSpeed Insights API failed',
        status: response.status,
        details: errorText,
        testUrl
      })
    }

    const data = await response.json()
    
    // Extract key metrics
    const performanceScore = data.lighthouseResult?.categories?.performance?.score * 100 || 0
    const audits = data.lighthouseResult?.audits || {}
    
    const coreWebVitals = {
      lcp: {
        score: audits['largest-contentful-paint']?.numericValue / 1000 || 0,
        status: audits['largest-contentful-paint']?.score === 1 ? 'good' : 
               audits['largest-contentful-paint']?.score === 0.5 ? 'needs-improvement' : 'poor'
      },
      fid: {
        score: audits['max-potential-fid']?.numericValue || 0,
        status: audits['max-potential-fid']?.score === 1 ? 'good' : 
               audits['max-potential-fid']?.score === 0.5 ? 'needs-improvement' : 'poor'
      },
      cls: {
        score: audits['cumulative-layout-shift']?.numericValue || 0,
        status: audits['cumulative-layout-shift']?.score === 1 ? 'good' : 
               audits['cumulative-layout-shift']?.score === 0.5 ? 'needs-improvement' : 'poor'
      },
      ttfb: {
        score: audits['server-response-time']?.numericValue || 0,
        status: audits['server-response-time']?.score === 1 ? 'good' : 
               audits['server-response-time']?.score === 0.5 ? 'needs-improvement' : 'poor'
      },
      fcp: {
        score: audits['first-contentful-paint']?.numericValue / 1000 || 0,
        status: audits['first-contentful-paint']?.score === 1 ? 'good' : 
               audits['first-contentful-paint']?.score === 0.5 ? 'needs-improvement' : 'poor'
      }
    }

    // Get some key opportunities for recommendations
    const opportunities = Object.entries(audits)
      .filter(([key, audit]: [string, any]) => audit.details?.type === 'opportunity' && audit.numericValue > 0)
      .slice(0, 3)
      .map(([key, audit]: [string, any]) => ({
        title: audit.title,
        description: audit.description,
        potentialSavings: `${Math.round(audit.numericValue / 1000)}s`
      }))

    return NextResponse.json({
      success: true,
      testUrl,
      performanceScore: Math.round(performanceScore),
      coreWebVitals,
      opportunities,
      message: 'PageSpeed Insights API is working correctly!',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('PageSpeed test error:', error)
    return NextResponse.json({ 
      error: 'Test failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      testUrl: 'https://deandesign.co'
    })
  }
}
