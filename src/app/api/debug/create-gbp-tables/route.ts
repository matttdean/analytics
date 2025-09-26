export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // SQL to create GBP tables
    const createTablesSQL = `
      -- GBP Business Data Table
      CREATE TABLE IF NOT EXISTS gbp_business_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        location_id TEXT NOT NULL,
        location_name TEXT NOT NULL,
        title TEXT,
        store_code TEXT,
        website_uri TEXT,
        primary_category TEXT,
        address JSONB,
        phone_numbers JSONB,
        regular_hours JSONB,
        profile JSONB,
        last_synced TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, location_id)
      );

      -- GBP Performance Data Table
      CREATE TABLE IF NOT EXISTS gbp_performance_data (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        location_id TEXT NOT NULL,
        metric TEXT NOT NULL,
        value INTEGER DEFAULT 0,
        period_start DATE NOT NULL,
        period_end DATE NOT NULL,
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, location_id, metric, period_start)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_gbp_business_data_user_id ON gbp_business_data(user_id);
      CREATE INDEX IF NOT EXISTS idx_gbp_business_data_location_id ON gbp_business_data(location_id);
      CREATE INDEX IF NOT EXISTS idx_gbp_performance_data_user_id ON gbp_performance_data(user_id);
      CREATE INDEX IF NOT EXISTS idx_gbp_performance_data_location_id ON gbp_performance_data(location_id);
      CREATE INDEX IF NOT EXISTS idx_gbp_performance_data_metric ON gbp_performance_data(metric);
      CREATE INDEX IF NOT EXISTS idx_gbp_performance_data_period ON gbp_performance_data(period_start, period_end);
    `

    // Try to execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: createTablesSQL })

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create tables',
        message: error.message,
        sql: createTablesSQL
      })
    }

    return NextResponse.json({
      success: true,
      message: 'GBP tables created successfully',
      tables: [
        'gbp_business_data - stores business information',
        'gbp_performance_data - stores performance metrics'
      ]
    })

  } catch (error: any) {
    console.error('Create GBP tables error:', error)
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

    // Check if tables exist
    const { data: businessTable, error: businessError } = await supabase
      .from('gbp_business_data')
      .select('*')
      .limit(1)

    const { data: performanceTable, error: performanceError } = await supabase
      .from('gbp_performance_data')
      .select('*')
      .limit(1)

    return NextResponse.json({
      success: true,
      tables: {
        gbp_business_data: {
          exists: !businessError,
          error: businessError?.message || null
        },
        gbp_performance_data: {
          exists: !performanceError,
          error: performanceError?.message || null
        }
      }
    })

  } catch (error: any) {
    console.error('Check GBP tables error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

