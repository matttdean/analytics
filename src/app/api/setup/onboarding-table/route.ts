import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    console.log('=== SETTING UP ONBOARDING TABLE ===')
    
    const supabase = await createWritableClient()
    
    // Create the user_onboarding table
    const { error: createError } = await supabase.rpc('create_onboarding_table')
    
    if (createError) {
      console.error('Table creation error:', createError)
      
      // Fallback: try to create table manually
      const { error: manualError } = await supabase
        .from('user_onboarding')
        .select('*')
        .limit(1)
      
      if (manualError) {
        console.log('Table does not exist, creating manually...')
        
        // Note: This is a simplified approach. In production, you'd use proper migrations
        console.log('Please create the user_onboarding table manually with the following SQL:')
        console.log(`
          CREATE TABLE IF NOT EXISTS user_onboarding (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            completed_at TIMESTAMP WITH TIME ZONE,
            ga4_property_id TEXT,
            gbp_connected BOOLEAN DEFAULT FALSE,
            search_console_connected BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_user_onboarding_user_unique ON user_onboarding(user_id);
        `)
        
        return NextResponse.json({
          success: false,
          error: 'table_creation_failed',
          message: 'Please create the user_onboarding table manually',
          sql: `
            CREATE TABLE IF NOT EXISTS user_onboarding (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
              completed_at TIMESTAMP WITH TIME ZONE,
              ga4_property_id TEXT,
              gbp_connected BOOLEAN DEFAULT FALSE,
              search_console_connected BOOLEAN DEFAULT FALSE,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            
            CREATE INDEX IF NOT EXISTS idx_user_onboarding_user_id ON user_onboarding(user_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_onboarding_user_unique ON user_onboarding(user_id);
          `
        })
      }
    }

    console.log('Onboarding table setup completed successfully')
    
    return NextResponse.json({
      success: true,
      message: 'Onboarding table setup completed'
    })

  } catch (error: any) {
    console.error('Onboarding table setup error:', error)
    return NextResponse.json({ 
      success: false,
      error: error?.message || 'unknown_error',
      details: error.toString()
    }, { status: 500 })
  }
}
