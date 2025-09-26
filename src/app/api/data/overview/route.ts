// src/app/api/data/overview/route.ts
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

/** Format YYYY-MM-DD in local time (avoid UTC shifts) */
function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

type SeriesRow = {
  date: string
  active_users: number
  sessions: number
  conversions: number
  total_revenue: number
  clicks?: number
  impressions?: number
  website_clicks?: number
  calls?: number
  directions?: number
  views_search?: number
  views_maps?: number
}

function sumByDate(rows: any[], fields: string[]) {
  const map = new Map<string, any>()
  for (const row of rows ?? []) {
    const date = row.date
    if (!date) continue
    if (!map.has(date)) {
      map.set(date, { date })
      for (const f of fields) map.get(date)[f] = 0
    }
    for (const f of fields) map.get(date)[f] += Number(row[f] ?? 0)
  }
  return map
}

function toSeries(map: Map<string, any>): SeriesRow[] {
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
}

function sumField(series: SeriesRow[], field: keyof SeriesRow, lastN: number) {
  if (lastN <= 0) return 0
  const slice = series.slice(-lastN)
  return slice.reduce((acc, r) => acc + Number(r[field] ?? 0), 0)
}

export async function GET(req: Request) {
  try {
    console.log('🔍 Overview API called')
    const url = new URL(req.url)
    const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '28')))
    // property can be numeric "123" or "properties/123" – we normalize to numeric for DB lookups
    let property = url.searchParams.get('property') ?? undefined
    const supabase = await createWritableClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.log('❌ No user found in overview API')
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }
    console.log('✅ User authenticated:', user.id, 'Property param:', property)

    // Resolve property from saved selection if not passed
    if (!property) {
      console.log('🔍 No property param, looking up from ga4_connections')
      const { data: conn, error: connErr } = await supabase
        .from('ga4_connections')
        .select('property_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (connErr) {
        console.error('❌ Error looking up ga4_connections:', connErr)
        return NextResponse.json({ error: 'connections_lookup_failed', detail: connErr.message }, { status: 500 })
      }
      console.log('🔍 ga4_connections result:', conn)
      property = conn?.property_id || undefined
    }
    if (!property) {
      console.log('❌ No property found, returning error')
      return NextResponse.json({ error: 'no_property_configured' }, { status: 400 })
    }
    console.log('✅ Using property:', property)

    // Normalize to numeric (DB stores numeric-only)
    const propertyNumeric = property.startsWith('properties/')
      ? property.split('/')[1]
      : property

    if (!/^\d+$/.test(propertyNumeric)) {
      return NextResponse.json({ error: 'invalid_property' }, { status: 400 })
    }

    // Authorize: ensure this user is mapped to this property
    const { data: authRow } = await supabase
      .from('ga4_connections')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('property_id', propertyNumeric)
      .maybeSingle()
    if (!authRow) {
      return NextResponse.json({ error: 'forbidden_property' }, { status: 403 })
    }

    // Window (local time)
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))

    const prevEnd = new Date(start)
    prevEnd.setDate(start.getDate() - 1)
    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevEnd.getDate() - (days - 1))

    const fromStr = ymdLocal(start)

    // ---- GA4 (per-property; DO NOT filter by user_id) ----
    const { data: ga4Rows, error: ga4Err } = await supabase
      .from('ga4_daily')
      .select('date, active_users, sessions, conversions, total_revenue')
      .eq('property_id', propertyNumeric)
      .gte('date', fromStr)



    // ---- GSC ----
    // If your GSC table is per-property, switch to .eq('property_id', propertyNumeric) instead of user_id
    const { data: gscRows, error: gscErr } = await supabase
      .from('gsc_daily')
      .select('date, clicks, impressions')
      .eq('user_id', user.id)
      .gte('date', fromStr)

    // ---- GBP ----
    // Same note as GSC: if you have property/location scoping, filter by that column
    const { data: gbpRows, error: gbpErr } = await supabase
      .from('gbp_daily')
      .select('date, website_clicks, calls, directions, views_search, views_maps')
      .eq('user_id', user.id)
      .gte('date', fromStr)

    if (ga4Err || gscErr || gbpErr) {
      return NextResponse.json(
        { error: (ga4Err || gscErr || gbpErr)?.message || 'overview_query_failed' },
        { status: 500 }
      )
    }

    // Aggregate across multiple connections per date
    const ga4Map = sumByDate(ga4Rows ?? [], ['active_users', 'sessions', 'conversions', 'total_revenue'])
    const gscMap = sumByDate(gscRows ?? [], ['clicks', 'impressions'])
    const gbpMap = sumByDate(gbpRows ?? [], ['website_clicks', 'calls', 'directions', 'views_search', 'views_maps'])

    const ga4 = toSeries(ga4Map)
    const gsc = toSeries(gscMap)
    const gbp = toSeries(gbpMap)

    // --- KPIs over current window (days) ---
    // Sum all users in the series (which should cover the requested time period)
    const usersNow = ga4.reduce((acc, r) => acc + Number(r.active_users ?? 0), 0)



    // Prior window for deltas
    const prevStartStr = ymdLocal(prevStart)
    const prevEndStr = ymdLocal(prevEnd)
    const inPrevWindow = (d: string) => d >= prevStartStr && d <= prevEndStr

    const ga4Prev = ga4.filter(r => inPrevWindow(r.date))
    const gbpPrev = gbp.filter(r => inPrevWindow(r.date))
    const gscPrev = gsc.filter(r => inPrevWindow(r.date))

    const usersPrev = ga4Prev.reduce((acc, r) => acc + Number(r.active_users ?? 0), 0)
    const usersDelta = usersPrev ? ((usersNow - usersPrev) / usersPrev) * 100 : 0

    // CTR over current window
    const clicks = gsc.reduce((acc, r) => acc + Number(r.clicks ?? 0), 0)
    const impressions = gsc.reduce((acc, r) => acc + Number(r.impressions ?? 0), 0)
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0

    // Interactions (GBP) current vs prior window
    const interactionsNow = gbp.reduce((acc, r) =>
      acc + Number(r.website_clicks ?? 0) + Number(r.calls ?? 0) + Number(r.directions ?? 0)
    , 0)

    const interactionsPrev = gbpPrev.reduce((acc, r) =>
      acc + Number(r.website_clicks ?? 0) + Number(r.calls ?? 0) + Number(r.directions ?? 0)
    , 0)

    const interactionsDelta = interactionsPrev ? ((interactionsNow - interactionsPrev) / interactionsPrev) * 100 : 0

    // Avg conversion rate (sessions guard) over current window
    const conversionRates = ga4
      .slice(-days)
      .map(r => Number(r.conversions ?? 0) / Math.max(Number(r.sessions ?? 0), 1))
      .filter(v => Number.isFinite(v) && v >= 0)

    const avgConversionRate = conversionRates.length
      ? (conversionRates.reduce((a, b) => a + b, 0) / conversionRates.length) * 100
      : 0

    const response = {
      kpis: {
        users: { value: usersNow, delta: usersDelta },
        ctr: { value: ctr, delta: 0 },
        interactions: { value: interactionsNow, delta: interactionsDelta },
        conversionRate: { value: avgConversionRate, delta: 0 },
      },
      ga4,
      gsc,
      gbp,
    }
    
    console.log('🔍 Overview API response:', {
      kpis: response.kpis,
      ga4Length: response.ga4?.length || 0,
      gscLength: response.gsc?.length || 0,
      gbpLength: response.gbp?.length || 0
    })
    
    return NextResponse.json(response)
  } catch (e: any) {
    console.error('overview route error:', e)
    return NextResponse.json({ error: 'overview_failed', message: e?.message || 'unknown_error' }, { status: 500 })
  }
}
