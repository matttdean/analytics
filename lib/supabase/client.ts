'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Quick sanity logs in the browser (leave while debugging)
  console.log('SB url:', url)
  console.log('SB anon len:', anon?.length ?? 0)

  if (!url || !anon) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')

  // Force implicit flow so magic links return #access_token (no PKCE)
  return createSupabaseClient(url, anon, {
    auth: {
      flowType: 'implicit',
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // auto-consume #access_token on /auth/callback
    },
  })
}
