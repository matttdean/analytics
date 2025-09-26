import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Clear only Search Console connections
    const { error: gscError } = await supabase
      .from('gsc_connections')
      .delete()
      .eq('user_id', user.id)

    if (gscError) {
      console.error('Error clearing GSC connections:', gscError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to clear Search Console connections' 
      }, { status: 500 })
    }

    // Also clear any Search Console daily data
    const { error: gscDataError } = await supabase
      .from('gsc_daily')
      .delete()
      .eq('user_id', user.id)

    if (gscDataError) {
      console.error('Error clearing GSC daily data:', gscDataError)
      // Don't fail the request for this, just log it
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Search Console tokens and data cleared successfully',
      cleared: {
        connections: true,
        dailyData: !gscDataError
      }
    })

  } catch (e: any) {
    console.error('Clear GSC tokens error:', e)
    return NextResponse.json({ 
      success: false, 
      error: e?.message || 'Unknown error occurred' 
    }, { status: 500 })
  }
}
