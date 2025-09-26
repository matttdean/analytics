export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import { createWritableClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createWritableClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

    // Try to get the table schema by attempting to select all columns
    const { data, error } = await supabase
      .from('ga4_connections')
      .select('*')
      .limit(1)

    if (error) {
      return NextResponse.json({
        error: 'database_error',
        detail: error.message,
        code: error.code
      }, { status: 500 })
    }

    // Get column names from the first row (if any)
    const columns = data && data.length > 0 ? Object.keys(data[0]) : []
    
    // Also try to get table info
    const { data: tableInfo, error: tableError } = await supabase
      .rpc('get_table_info', { table_name: 'ga4_connections' })
      .catch(() => ({ data: null, error: 'rpc_not_available' }))

    return NextResponse.json({
      success: true,
      columns,
      sampleRow: data && data.length > 0 ? data[0] : null,
      tableInfo: tableError === 'rpc_not_available' ? 'RPC not available' : tableInfo
    })

  } catch (error) {
    console.error('Table schema debug error:', error)
    return NextResponse.json({
      error: 'internal_error',
      detail: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
