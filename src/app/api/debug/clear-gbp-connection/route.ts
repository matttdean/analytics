export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function DELETE() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Delete the user's GBP connection
    const { error } = await supabase
      .from('gbp_connections')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message
      })
    }

    return NextResponse.json({
      success: true,
      message: 'GBP connection cleared successfully'
    })

  } catch (error: any) {
    console.error('Clear GBP connection error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Check current GBP connection
    const { data: connection } = await supabase
      .from('gbp_connections')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({
      success: true,
      has_connection: !!connection,
      connection: connection || null
    })

  } catch (error: any) {
    console.error('Check GBP connection error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

