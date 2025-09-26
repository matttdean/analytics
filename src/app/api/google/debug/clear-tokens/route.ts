export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    const { error } = await supabase
      .from('google_oauth_tokens')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({
        error: 'delete_failed',
        detail: error.message
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Tokens cleared successfully. Please reconnect your Google account.'
    })

  } catch (error) {
    console.error('Clear tokens error:', error)
    return NextResponse.json({
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
