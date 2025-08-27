'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

function sleep(ms: number) {
  return new Promise(res => setTimeout(res, ms))
}

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Warm the Supabase auth origin so the first POST doesn't cold-fail
  async function warmSupabase() {
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      // hit a cheap GET that works without auth; include apikey so the edge knows us
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anon },
        cache: 'no-store',
      })
      return res.ok
    } catch {
      return false
    }
  }

  async function signInWithRetry(tries = 3) {
    let lastErr: any = null
    for (let i = 0; i < tries; i++) {
      try {
        // IMPORTANT: do NOT signOut here; it adds a needless network hop that can race
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${location.origin}/auth/callback`,
          },
        })
        if (!error) return
        lastErr = error
      } catch (e) {
        lastErr = e
      }
      // backoff between attempts
      await sleep(i === 0 ? 350 : 800)
      // re-warm on retry just in case
      await warmSupabase()
    }
    throw lastErr ?? new Error('Network error')
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // warm the edge once before first POST (fixes the “first call fails” flake)
      await warmSupabase()
      await signInWithRetry()
      setSent(true)
    } catch (err: any) {
      console.error('signInWithOtp failed:', err)
      setError(err?.message || 'Network error (failed to reach Supabase)')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-zinc-50">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Sign in</h1>

        {!sent ? (
          <>
            <label htmlFor="email" className="text-sm text-zinc-600">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-md border px-3 py-2 outline-none focus:ring-2 focus:ring-black/10"
              required
            />

            {error && <div className="text-sm text-red-600">{error}</div>}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full rounded-md bg-black text-white py-2 disabled:opacity-60"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>

            <p className="text-xs text-zinc-500">
              Open the link in this <b>same browser</b>. If your mail app pre-opens links,
              right-click → <i>Copy link address</i> and paste it here.
            </p>
          </>
        ) : (
          <p className="text-sm text-zinc-700">
            Magic link sent to <b>{email}</b>. Check your email and click the link from this browser.
          </p>
        )}
      </form>
    </main>
  )
}
