import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from 'src/components/dashboard/Sidebar'
import Topbar from 'src/components/dashboard/Topbar'
import KpiStrip from 'src/components/dashboard/KpiStrip'
import OverviewCharts from './ui/OverviewCharts'
import ActiveNow from 'src/components/dashboard/ActiveNow'
import SelectGa4Property from 'src/components/dashboard/SelectGa4Property'
import ConnectGoogle from 'src/components/ConnectGoogle'

// Run per-request (avoid caching an unauthenticated render)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 🔐 Hard guard: if no session, go to /login
  if (!user) redirect('/login')

  // Is Google connected?
  const { data: tokenRow } = await supabase
    .from('google_oauth_tokens')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  // Has the user selected a GA4 property?
  const { data: ga4Conn } = await supabase
    .from('ga4_connections')
    .select('property_id, property_display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const propertyId = ga4Conn?.property_id as string | undefined
  const propertyLabel =
    ga4Conn?.property_display_name
      ? `${ga4Conn.property_display_name} — ${ga4Conn.property_id}`
      : ga4Conn?.property_id

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Topbar userEmail={user.email ?? ''} />
          <div className="space-y-8 px-6 pb-10">
            {/* Realtime (only once a property is selected) */}
            {tokenRow && propertyId && <ActiveNow property={propertyId} />}

            {/* KPIs (from your stored daily data) */}
            <KpiStrip />

            {/* If not connected to Google yet, show connect CTA */}
            {!tokenRow && (
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="mb-2 font-medium">Connect Google</h3>
                <p className="mb-4 text-sm text-zinc-600">
                  Connect your Google account to pull GA4, Search Console, and Google Business Profile metrics.
                </p>
                <ConnectGoogle />
              </section>
            )}

            {/* If connected but no GA4 property chosen, show picker */}
            {tokenRow && !propertyId && <SelectGa4Property />}

            {/* Once property is chosen, show charts */}
            {tokenRow && propertyId && (
              <section className="rounded-2xl border bg-white p-6 shadow-sm">
                <h3 className="mb-1 font-medium">Traffic &amp; Visibility — Last 28 days</h3>
                {propertyLabel && (
                  <p className="mb-4 text-xs text-zinc-500">
                    Property: {propertyLabel}
                  </p>
                )}
                <OverviewCharts />
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
