import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    console.log('🧪 Test Auth API: Starting...')
    
    const supabase = await createWritableClient()
    console.log('🧪 Test Auth API: Supabase client created')
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    console.log('🧪 Test Auth API: Auth check result:', { 
      hasUser: !!user, 
      error, 
      userId: user?.id,
      userEmail: user?.email 
    })

    if (error || !user) {
      return NextResponse.json({ 
        authenticated: false, 
        error: error?.message || 'No user found',
        message: 'User is not authenticated'
      })
    }

    return NextResponse.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        email: user.email,
        message: 'User is authenticated'
      }
    })

  } catch (e: any) {
    console.error('🧪 Test Auth API: Error:', e)
    return NextResponse.json({ 
      authenticated: false, 
      error: e?.message || 'Unknown error',
      message: 'Authentication check failed'
    }, { status: 500 })
  }
}
