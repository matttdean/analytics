'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Topbar({ userEmail }: { userEmail?: string }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/80 backdrop-blur px-6 py-3">
      <div className="font-medium">
        {process.env.NEXT_PUBLIC_APP_NAME ?? 'Dashboard'}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">
          Signed in as{' '}
          <span className="font-medium text-zinc-900">
            {userEmail || '—'}
          </span>
        </span>
        <button
          onClick={signOut}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-zinc-50"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
