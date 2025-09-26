export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'
import { decrypt, encrypt } from '@/lib/crypto'

function ymd(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Normalize location ID from "accounts/{account}/locations/{location}" to "locations/{location}"
function normalizeLocationId(locationName: string) {
  if (!locationName) return locationName
  const parts = locationName.split('/')
  const locationsIndex = parts.indexOf('locations')
  if (locationsIndex >= 0 && parts[locationsIndex + 1]) {
    return `locations/${parts[locationsIndex + 1]}`
  }
  return locationName
}

async function ensureAccessToken(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('access_token_cipher, access_token_iv, access_token_tag, refresh_token_cipher, refresh_token_iv, refresh_token_tag, expiry')
    .eq('user_id', userId).maybeSingle()
  if (error || !data) throw new Error('missing_google_tokens')

  const access = decrypt(data.access_token_cipher, Buffer.from(data.access_token_iv, 'base64'), Buffer.from(data.access_token_tag, 'base64'))
  const refresh = decrypt(data.refresh_token_cipher, Buffer.from(data.refresh_token_iv, 'base64'), Buffer.from(data.refresh_token_tag, 'base64'))
  let accessToken = access
  const exp = data.expiry ? Date.parse(data.expiry) : 0
  if (!accessToken || (exp && Date.now() > exp - 60_000)) {
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }).toString()
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body })
    const j = await r.json()
    if (!r.ok) throw new Error(`refresh_failed:${j?.error || r.status}`)
    accessToken = j.access_token
    const enc = encrypt(accessToken)
    const expISO = new Date(Date.now() + (j.expires_in || 3600) * 1000).toISOString()
    await supabase.from('google_oauth_tokens').update({
      access_token_cipher: enc.cipher,
      access_token_iv: enc.iv.toString('base64'),
      access_token_tag: enc.tag.toString('base64'),
      expiry: expISO,
      updated_at: new Date().toISOString(),
    }).eq('user_id', userId)
  }
  return accessToken
}

export async function GET(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const url = new URL(req.url)
    const override = url.searchParams.get('location') || undefined

    const accessToken = await ensureAccessToken(supabase, user.id)

    // Resolve saved location
    let locationName = override
    if (!locationName) {
      const { data: conn } = await supabase
        .from('gbp_connections')
        .select('location_name, label')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!conn?.location_name) {
        return NextResponse.json({
          error: 'no_gbp_location_configured',
          message: 'No Google Business Profile location configured. Please select a location to connect.'
        }, { status: 400 })
      }
      locationName = conn.location_name // e.g. "locations/2765560021277676673"
    }

    // Normalize location ID for Business Information API
    const normalizedLocationId = normalizeLocationId(locationName)
    console.log('Using location ID:', normalizedLocationId, 'from original:', locationName)
    
    // Business Information GET (with working readMask - includes storefrontAddress and regularHours)
    const readMask = 'title,categories,phoneNumbers,websiteUri,profile,storefrontAddress,regularHours'
    const infoRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${normalizedLocationId}?readMask=${encodeURIComponent(readMask)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    
    let info: any
    try {
      info = await infoRes.json()
    } catch (e) {
      // If response is not JSON (e.g., HTML error page), get the text
      console.error('Business Info API returned non-JSON response:', {
        status: infoRes.status,
        statusText: infoRes.statusText,
        error: e?.message
      })
      return NextResponse.json({ 
        error: 'business_info_invalid_response', 
        message: 'Business Information API returned invalid response',
        status: infoRes.status
      }, { status: 500 })
    }
    
    if (!infoRes.ok) {
      console.error('Business Info API error:', {
        status: infoRes.status,
        statusText: infoRes.statusText,
        response: info
      })
      return NextResponse.json({ error: 'business_info_failed', detail: info }, { status: infoRes.status })
    }

    // Performance API POST (correct endpoint + date objects)
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - 27)

    console.log('Performance API URL:', `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics`)
    console.log('Performance API request body:', {
      metricRequests: [
        { metric: 'CALL_CLICKS' },
        { metric: 'WEBSITE_CLICKS' },
        { metric: 'DRIVING_DIRECTIONS' }
      ],
      timeRange: {
        startDate: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
        endDate:   { year: end.getFullYear(),   month: end.getMonth() + 1,   day: end.getDate() }
      }
    })
    
    const perfRes = await fetch(
      `https://businessprofileperformance.googleapis.com/v1/${normalizedLocationId}:fetchMetrics`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          metricRequests: [
            { metric: 'CALL_CLICKS' },
            { metric: 'WEBSITE_CLICKS' },
            { metric: 'DRIVING_DIRECTIONS' }
          ],
          timeRange: {
            startDate: { year: start.getFullYear(), month: start.getMonth() + 1, day: start.getDate() },
            endDate:   { year: end.getFullYear(),   month: end.getMonth() + 1,   day: end.getDate() }
          }
        })
      }
    )
    
    let perf: any
    try {
      perf = await perfRes.json()
    } catch (e) {
      console.warn('Performance API returned non-JSON response:', {
        status: perfRes.status,
        statusText: perfRes.statusText,
        error: e?.message,
        url: `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMetrics`
      })
      // Return business info with zero performance
      return NextResponse.json({
        business: shapeBusiness(info),
        performance: zeroPerf(),
        period: { current: { start: ymd(start), end: ymd(end) } },
        warning: { performance: 'Performance API returned invalid response' }
      })
    }
    
    if (!perfRes.ok) {
      console.warn('Performance API error:', {
        status: perfRes.status,
        statusText: perfRes.statusText,
        response: perf
      })
      // return zeros but surface message
      return NextResponse.json({
        business: shapeBusiness(info),
        performance: zeroPerf(),
        period: { current: { start: ymd(start), end: ymd(end) } },
        warning: { performance: perf }
      })
    }

    const sums = Object.fromEntries((perf.timeSeries ?? []).map((ts: any) => {
      const total = (ts.datedValues ?? []).reduce((a: number, dv: any) => a + Number(dv.value ?? 0), 0)
      return [ts.metric, total]
    }))

    return NextResponse.json({
      business: shapeBusiness(info),
      performance: {
        calls: { current: sums.CALL_CLICKS ?? 0, previous: 0, change: 0 },
        websiteClicks: { current: sums.WEBSITE_CLICKS ?? 0, previous: 0, change: 0 },
        directionRequests: { current: sums.DRIVING_DIRECTIONS ?? 0, previous: 0, change: 0 },
      },
      period: { current: { start: ymd(start), end: ymd(end) } }
    })
  } catch (e: any) {
    console.error('business-profile route error:', e)
    return NextResponse.json({ error: e?.message || 'unknown_error' }, { status: 500 })
  }
}

function shapeBusiness(info: any) {
  // Now we have storefrontAddress and regularHours in the readMask
  const address = info?.storefrontAddress ? [
    info.storefrontAddress.addressLines?.join(' '),
    info.storefrontAddress.locality,
    info.storefrontAddress.administrativeArea,
    info.storefrontAddress.postalCode,
  ].filter(Boolean).join(', ') : 'Address not available'
  
  return {
    name: info?.title || 'Business',
    category: info?.categories?.primaryCategory?.displayName || '',
    address,
    phone: info?.phoneNumbers?.primaryPhone || '',
    website: info?.websiteUri || '',
    hours: info?.regularHours?.periods ?? [],
    description: info?.profile?.description ?? ''
  }
}

function zeroPerf() {
  return {
    calls: { current: 0, previous: 0, change: 0 },
    websiteClicks: { current: 0, previous: 0, change: 0 },
    directionRequests: { current: 0, previous: 0, change: 0 },
  }
}