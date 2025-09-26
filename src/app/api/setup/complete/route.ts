import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    // Mark onboarding as complete
    const { error } = await supabase
      .from('user_onboarding')
      .upsert({
        user_id: user.id,
        is_complete: true,
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (error) {
      console.error('Error completing onboarding:', error)
      return NextResponse.json({ error: 'failed_to_complete_onboarding' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Onboarding completed successfully' })

  } catch (error: any) {
    console.error('Complete onboarding error:', error)
    return NextResponse.json({ 
      error: 'setup_failed', 
      message: error.message 
    }, { status: 500 })
  }
}


