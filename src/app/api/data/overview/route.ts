// src/app/api/data/overview/route.ts
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

type NumRecord = Record<string, number>
type SeriesRow = { date: string } & Record<string, number | string> // <- allow 'date' to be string

const ymd = (d: Date) => d.toISOString().slice(0, 10)

/** Sum specified numeric fields by date */
function sumByDate(rows: any[] | null | undefined, keys: readonly string[], dateKey = 'date') {
  const map: Record<string, NumRecord> = {}
  for (const r of rows ?? []) {
    const d = String((r as any)[dateKey])
    if (!map[d]) {
      map[d] = {}
      for (const k of keys) map[d][k] = 0
    }
    for (const k of keys) map[d][k] += Number((r as any)[k] ?? 0)
  }
  return map
}

function toSeries(map: Record<string, NumRecord>): SeriesRow[] {
  return Object.keys(map).sort().map(d => ({ date: d, ...map[d] }))
}

function sumField(series: SeriesRow[], field: string, lastNDays: number) {
  const N = Math.min(lastNDays, series.length)
  const slice = series.slice(series.length - N)
  return slice.reduce((acc, r) => acc + Number(r[field] ?? 0), 0)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? '28')))

  const supabase = await createWritableClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  const fromStr = ymd(from)

  // ---- GA4 ----
  const { data: ga4Rows, error: ga4Err } = await supabase
    .from('ga4_daily')
    .select('date, active_users, sessions, conversions, total_revenue')
    .eq('user_id', user.id)
    .gte('date', fromStr)

  // ---- GSC ----
  const { data: gscRows, error: gscErr } = await supabase
    .from('gsc_daily')
    .select('date, clicks, impressions')
    .eq('user_id', user.id)
    .gte('date', fromStr)

  // ---- GBP ----
  const { data: gbpRows, error: gbpErr } = await supabase
    .from('gbp_daily')
    .select('date, website_clicks, calls, directions, views_search, views_maps')
    .eq('user_id', user.id)
    .gte('date', fromStr)

  if (ga4Err || gscErr || gbpErr) {
    return NextResponse.json({ error: ga4Err?.message || gscErr?.message || gbpErr?.message }, { status: 500 })
  }

  // Aggregate (sum across multiple connections per date)
  const ga4Map = sumByDate(ga4Rows, ['active_users', 'sessions', 'conversions', 'total_revenue'])
  const gscMap = sumByDate(gscRows, ['clicks', 'impressions'])
  const gbpMap = sumByDate(gbpRows, ['website_clicks', 'calls', 'directions', 'views_search', 'views_maps'])

  const ga4 = toSeries(ga4Map)
  const gsc = toSeries(gscMap)
  const gbp = toSeries(gbpMap)

  // KPIs
  const kWindow = 7
  const usersNow = sumField(ga4, 'active_users', kWindow)
  const usersPrev = sumField(ga4.slice(0, Math.max(ga4.length - kWindow, 0)), 'active_users', kWindow)
  const usersDelta = usersPrev ? ((usersNow - usersPrev) / usersPrev) * 100 : 0

  const clicks = sumField(gsc, 'clicks', days)
  const impressions = Math.max(1, sumField(gsc, 'impressions', days))
  const ctr = (clicks / impressions) * 100

  const interactionsNow =
    sumField(gbp, 'website_clicks', kWindow) +
    sumField(gbp, 'calls', kWindow) +
    sumField(gbp, 'directions', kWindow)

  const prevSlice = gbp.slice(0, Math.max(gbp.length - kWindow, 0))
  const interactionsPrev =
    sumField(prevSlice, 'website_clicks', kWindow) +
    sumField(prevSlice, 'calls', kWindow) +
    sumField(prevSlice, 'directions', kWindow)

  const interactionsDelta = interactionsPrev ? ((interactionsNow - interactionsPrev) / interactionsPrev) * 100 : 0

  return NextResponse.json({
    kpis: {
      users: { value: usersNow, delta: usersDelta },
      ctr: { value: ctr, delta: 0 },
      interactions: { value: interactionsNow, delta: interactionsDelta },
    },
    ga4,
    gsc,
    gbp,
  })
}
