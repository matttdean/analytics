// app/api/sync/route.ts  (or src/app/api/sync/route.ts)
import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/crypto'
import { refreshAccessToken } from '@/lib/google'

// ---------- Types ----------
type GA4Row = {
  date: string
  active_users: number
  sessions: number
  conversions: number
  total_revenue: number
}

type GSCRow = {
  date: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

type GBPRow = {
  date: string
  website_clicks: number
  calls: number
  directions: number
  views_search: number
  views_maps: number
}

// ----- Admin Supabase client (service role bypasses RLS) -----
const ADMIN = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ----- tiny helpers -----
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const hex = (b: Buffer) => '\\x' + b.toString('hex')

// Convert Supabase bytea to Buffer
function toBuf(v: unknown): Buffer {
  if (v instanceof Uint8Array) return Buffer.from(v)
  if (typeof v === 'string') {
    if (v.startsWith('\\x') || v.startsWith('0x')) return Buffer.from(v.replace(/^\\x|^0x/, ''), 'hex')
    return Buffer.from(v, 'base64')
  }
  if (typeof v === 'object' && v && (v as any).type === 'Buffer' && Array.isArray((v as any).data)) {
    return Buffer.from((v as any).data)
  }
  throw new Error('Unsupported bytea format from Supabase')
}

// ----- Google fetchers (GA4 / GSC / GBP) -----
async function fetchGA4(accessToken: string, propertyId: string, start: string, end: string): Promise<GA4Row[]> {
  const url = `https://analyticsdata.googleapis.com/v1beta/${propertyId}:runReport`
  const body = {
    dateRanges: [{ startDate: start, endDate: end }],
    metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'conversions' }, { name: 'totalRevenue' }],
    dimensions: [{ name: 'date' }],
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 report failed: ${res.status}`)
  const json = await res.json()
  return (json.rows || []).map((r: any) => ({
    date: r.dimensionValues[0].value as string,
    active_users: Number(r.metricValues[0]?.value || 0),
    sessions: Number(r.metricValues[1]?.value || 0),
    conversions: Number(r.metricValues[2]?.value || 0),
    total_revenue: Number(r.metricValues[3]?.value || 0),
  }))
}

async function fetchGSC(accessToken: string, siteUrl: string, start: string, end: string): Promise<GSCRow[]> {
  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
  const body = { startDate: start, endDate: end, dimensions: ['date'] }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GSC query failed: ${res.status}`)
  const json = await res.json()
  return (json.rows || []).map((r: any) => ({
    date: r.keys[0] as string,
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }))
}

function ymd(d: string) {
  const [y, m, dd] = d.split('-').map(Number)
  return { year: y, month: m, day: dd }
}

async function fetchGBP(accessToken: string, locationName: string, start: string, end: string): Promise<GBPRow[]> {
  const url = `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries`
  const body = {
    dailyMetrics: ['WEBSITE_CLICKS', 'CALLS', 'DIRECTION_REQUESTS', 'VIEWS_SEARCH', 'VIEWS_MAPS'],
    dailyRange: { startDate: ymd(start), endDate: ymd(end) },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GBP fetch failed: ${res.status}`)
  const json = await res.json()

  const map: Record<string, GBPRow> = {}
  for (const series of json.timeSeries || []) {
    const metric: string = series.dailyMetric
    for (const p of series.timeSeries || []) {
      const d = `${p.date.year}-${String(p.date.month).padStart(2, '0')}-${String(p.date.day).padStart(2, '0')}`
      map[d] ||= { date: d, website_clicks: 0, calls: 0, directions: 0, views_search: 0, views_maps: 0 }
      switch (metric) {
        case 'WEBSITE_CLICKS': map[d].website_clicks = Number(p.value || 0); break
        case 'CALLS': map[d].calls = Number(p.value || 0); break
        case 'DIRECTION_REQUESTS': map[d].directions = Number(p.value || 0); break
        case 'VIEWS_SEARCH': map[d].views_search = Number(p.value || 0); break
        case 'VIEWS_MAPS': map[d].views_maps = Number(p.value || 0); break
      }
    }
  }
  return Object.values(map)
}

// ----- Access token (admin path for cron) -----
async function getAccessTokenAdmin(userId: string): Promise<string> {
  const { data, error } = await ADMIN
    .from('google_oauth_tokens')
    .select(
      'id, access_token_cipher, refresh_token_cipher, access_iv, access_tag, refresh_iv, refresh_tag, expiry'
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) throw new Error(`No Google tokens for user ${userId}`)

  const accessPlain = decrypt(data.access_token_cipher, toBuf(data.access_iv as any), toBuf(data.access_tag as any))
  const refreshPlain = decrypt(
    data.refresh_token_cipher,
    toBuf(data.refresh_iv as any),
    toBuf(data.refresh_tag as any)
  )

  const expired = new Date(data.expiry).getTime() < Date.now() + 60_000
  if (!expired) return accessPlain

  // refresh
  const refreshed = await refreshAccessToken(refreshPlain)
  const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const encA = encrypt(refreshed.access_token)

  const { error: upErr } = await ADMIN
    .from('google_oauth_tokens')
    .update({
      access_token_cipher: encA.cipher,
      access_iv: hex(encA.iv),
      access_tag: hex(encA.tag),
      expiry: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('id', data.id)

  if (upErr) throw upErr
  return refreshed.access_token
}

// ----- Route Handler -----
export async function POST(req: Request) {
  // Cron auth
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  // Backfill last 28d
  const end = new Date()
  const start = new Date(Date.now() - 27 * 86400_000)
  const startStr = fmt(start)
  const endStr = fmt(end)

  // All users with Google tokens
  const { data: users, error: uErr } = await ADMIN.from('google_oauth_tokens').select('user_id')
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })
  if (!users || users.length === 0) return NextResponse.json({ ok: true, changed: 0 })

  let changed = 0

  for (const u of users as { user_id: string }[]) {
    const userId = u.user_id
    const access = await getAccessTokenAdmin(userId)

    // GA4
    const { data: ga4c } = await ADMIN.from('ga4_connections').select('*').eq('user_id', userId)
    for (const c of ga4c || []) {
      const rows: GA4Row[] = await fetchGA4(access, c.property_id, startStr, endStr)
      if (rows.length) {
        const payload = rows.map((r: GA4Row) => ({
          user_id: userId,
          property_id: c.property_id,
          date: r.date,
          sessions: r.sessions,
          active_users: r.active_users,
          conversions: r.conversions,
          total_revenue: r.total_revenue,
        }))
        const { error } = await ADMIN.from('ga4_daily').upsert(payload)
        if (error) throw error
        changed += payload.length
      }
    }

    // GSC
    const { data: gscc } = await ADMIN.from('gsc_connections').select('*').eq('user_id', userId)
    for (const c of gscc || []) {
      const rows: GSCRow[] = await fetchGSC(access, c.site_url, startStr, endStr)
      if (rows.length) {
        const payload = rows.map((r: GSCRow) => ({
          user_id: userId,
          site_url: c.site_url,
          date: r.date,
          clicks: r.clicks,
          impressions: r.impressions,
          ctr: r.ctr,
          position: r.position,
        }))
        const { error } = await ADMIN.from('gsc_daily').upsert(payload)
        if (error) throw error
        changed += payload.length
      }
    }

    // GBP
    const { data: gbpc } = await ADMIN.from('gbp_connections').select('*').eq('user_id', userId)
    for (const c of gbpc || []) {
      const rows: GBPRow[] = await fetchGBP(access, c.location_name, startStr, endStr)
      if (rows.length) {
        const payload = rows.map((r: GBPRow) => ({
          user_id: userId,
          location_name: c.location_name,
          date: r.date,
          views_search: r.views_search,
          views_maps: r.views_maps,
          website_clicks: r.website_clicks,
          calls: r.calls,
          directions: r.directions,
        }))
        const { error } = await ADMIN.from('gbp_daily').upsert(payload)
        if (error) throw error
        changed += payload.length
      }
    }
  }

  return NextResponse.json({ ok: true, changed })
}

// Optional: allow GET for quick manual tests (needs header in a client like curl)
export const GET = POST
