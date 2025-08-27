'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Session } from '@supabase/supabase-js'

async function waitForClientSession(timeoutMs = 1500): Promise<Session | null> {
  const supabase = createClient()
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) return session
    // give Supabase a moment to hydrate from the URL/hash
    await new Promise(r => setTimeout(r, 50))
  }
  return null
}

async function syncServerSession(session?: Session) {
  const supabase = createClient()
  const sess = session ?? (await supabase.auth.getSession()).data.session
  if (!sess) return false
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      access_token: sess.access_token,
      refresh_token: sess.refresh_token,
    }),
    cache: 'no-store',
  })
  return res.ok
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const qp = useSearchParams()

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()

      const err = qp.get('error_description') || qp.get('error')
      if (err) return router.replace(`/login?error=${encodeURIComponent(err)}`)

      // 1) IMPLICIT: tokens in URL hash (#access_token=...)
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      if (hash && hash.includes('access_token')) {
        // wait until the client session is hydrated
        const session = await waitForClientSession()
        const ok = await syncServerSession(session ?? undefined)
        return router.replace(ok ? '/dashboard' : '/login?error=session%20sync%20failed')
      }

      // 2) LEGACY MAGIC LINK: ?token_hash=...&type=...
      const token_hash = qp.get('token_hash')
      const type = (qp.get('type') || 'magiclink') as
        'magiclink' | 'recovery' | 'invite' | 'signup' | 'email_change'
      if (token_hash) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash, type })
        if (!error) {
          const ok = await syncServerSession(data.session ?? undefined)
          return router.replace(ok ? '/dashboard' : '/login?error=session%20sync%20failed')
        }
      }

      // 3) PKCE CODE: ?code=...
      const code = qp.get('code')
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          const ok = await syncServerSession(data.session ?? undefined)
          return router.replace(ok ? '/dashboard' : '/login?error=session%20sync%20failed')
        }
      }

      // 4) Nothing worked
      router.replace('/login?error=Email%20link%20is%20invalid%20or%20has%20expired')
    }

    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="text-sm text-zinc-600">Signing you in…</div>
    </main>
  )
}
