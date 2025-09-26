export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Check if gbp_connections table exists by trying to select from it
    const { data, error } = await supabase
      .from('gbp_connections')
      .select('*')
      .limit(1)

    if (error) {
      // Table doesn't exist or has issues
      return NextResponse.json({
        exists: false,
        error: error.message,
        code: error.code,
        sql: `
          CREATE TABLE IF NOT EXISTS gbp_connections (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            location_name TEXT NOT NULL,
            label TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          );
          
          CREATE INDEX IF NOT EXISTS idx_gbp_connections_user_id ON gbp_connections(user_id);
        `
      })
    }

    return NextResponse.json({
      exists: true,
      columns: data && data.length > 0 ? Object.keys(data[0]) : [],
      sampleRow: data && data.length > 0 ? data[0] : null
    })

  } catch (error) {
    console.error('GBP table check error:', error)
    return NextResponse.json({
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Try to create the table using raw SQL
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS gbp_connections (
          user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          location_name TEXT NOT NULL,
          label TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_gbp_connections_user_id ON gbp_connections(user_id);
      `
    })

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        message: 'Table creation failed. Please create manually using the SQL provided in the GET response.'
      })
    }

    return NextResponse.json({
      success: true,
      message: 'gbp_connections table created successfully'
    })

  } catch (error) {
    console.error('GBP table creation error:', error)
    return NextResponse.json({
      success: false,
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

