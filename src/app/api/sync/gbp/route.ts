export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/crypto'

// Normalize "accounts/.../locations/..." -> "locations/{id}"
function toShortLocation(name: string) {
  if (!name) return name
  const parts = name.split('/')
  const i = parts.indexOf('locations')
  return i >= 0 && parts[i+1] ? `locations/${parts[i+1]}` : name
}

async function getAccessToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  const access = decrypt(
    data.access_token_cipher,
    Buffer.from(data.access_token_iv, 'base64'),
    Buffer.from(data.access_token_tag, 'base64')
  )
  return access
}

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const accessToken = await getAccessToken(supabase, user.id)

    // Get user's GBP connection
    const { data: gbpConn } = await supabase
      .from('gbp_connections')
      .select('location_name, label')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!gbpConn) {
      return NextResponse.json({ 
        error: 'no_gbp_connection',
        message: 'No Google Business Profile connection found. Please connect a location first.'
      }, { status: 400 })
    }

    const shortLocation = toShortLocation(gbpConn.location_name)
    console.log('Syncing GBP data for location:', shortLocation)

    // Fetch Business Information
    const infoRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${shortLocation}?readMask=title,storeCode,websiteUri,primaryCategory,storefrontAddress,phoneNumbers,regularHours,profile`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!infoRes.ok) {
      const errorData = await infoRes.json()
      console.error('Business Info API error:', errorData)
      return NextResponse.json({
        error: 'business_info_failed',
        detail: errorData
      }, { status: infoRes.status })
    }

    const businessInfo = await infoRes.json()
    console.log('Business Info fetched:', businessInfo)

    // Fetch Performance Data (last 28 days)
    const today = new Date()
    const endDate = today.toISOString().split('T')[0]
    const startDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const perfUrl = `https://businessprofileperformance.googleapis.com/v1/${shortLocation}:fetchMetrics`
    const metricRequests = [
      { metric: 'CALL_CLICKS' },
      { metric: 'WEBSITE_CLICKS' },
      { metric: 'DRIVING_DIRECTIONS' },
    ]

    const perfRes = await fetch(perfUrl, {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${accessToken}`, 
        'content-type': 'application/json' 
      },
      body: JSON.stringify({
        metricRequests,
        timeRange: { 
          startTime: `${startDate}T00:00:00Z`, 
          endTime: `${endDate}T23:59:59Z` 
        },
      }),
    })

    let performanceData = null
    if (perfRes.ok) {
      performanceData = await perfRes.json()
      console.log('Performance data fetched:', performanceData)
    } else {
      console.warn('Performance API failed:', perfRes.status, await perfRes.text())
    }

    // Store business information
    const businessData = {
      user_id: user.id,
      location_id: shortLocation,
      location_name: gbpConn.location_name,
      title: businessInfo.title || gbpConn.label || 'Business',
      store_code: businessInfo.storeCode || null,
      website_uri: businessInfo.websiteUri || null,
      primary_category: businessInfo.primaryCategory?.displayName || null,
      address: businessInfo.storefrontAddress ? {
        address_lines: businessInfo.storefrontAddress.addressLines || [],
        locality: businessInfo.storefrontAddress.locality || null,
        administrative_area: businessInfo.storefrontAddress.administrativeArea || null,
        postal_code: businessInfo.storefrontAddress.postalCode || null,
        region_code: businessInfo.storefrontAddress.regionCode || null,
      } : null,
      phone_numbers: businessInfo.phoneNumbers ? {
        primary_phone: businessInfo.phoneNumbers.primaryPhone || null,
        additional_phones: businessInfo.phoneNumbers.additionalPhones || [],
      } : null,
      regular_hours: businessInfo.regularHours?.periods || [],
      profile: businessInfo.profile ? {
        description: businessInfo.profile.description || null,
      } : null,
      last_synced: new Date().toISOString(),
    }

    // Upsert business data
    const { error: businessError } = await supabase
      .from('gbp_business_data')
      .upsert(businessData, { onConflict: 'user_id,location_id' })

    if (businessError) {
      console.error('Error storing business data:', businessError)
      return NextResponse.json({
        error: 'database_error',
        message: 'Failed to store business data',
        detail: businessError.message
      }, { status: 500 })
    }

    // Store performance data if available
    if (performanceData && performanceData.timeSeries) {
      const performanceRecords = performanceData.timeSeries.map((series: any) => {
        const total = (series.datedValues || []).reduce((sum: number, dv: any) => sum + Number(dv.value || 0), 0)
        return {
          user_id: user.id,
          location_id: shortLocation,
          metric: series.metric,
          value: total,
          period_start: startDate,
          period_end: endDate,
          synced_at: new Date().toISOString(),
        }
      })

      if (performanceRecords.length > 0) {
        const { error: perfError } = await supabase
          .from('gbp_performance_data')
          .upsert(performanceRecords, { onConflict: 'user_id,location_id,metric,period_start' })

        if (perfError) {
          console.error('Error storing performance data:', perfError)
          // Don't fail the whole request for performance data errors
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'GBP data synced successfully',
      data: {
        business_info: !!businessInfo,
        performance_data: !!performanceData,
        location: shortLocation,
        synced_at: new Date().toISOString()
      }
    })

  } catch (error: any) {
    console.error('GBP sync error:', error)
    return NextResponse.json({
      error: 'sync_failed',
      message: error.message
    }, { status: 500 })
  }
}

