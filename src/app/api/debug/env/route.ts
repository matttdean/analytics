export const runtime = 'nodejs'
import { NextResponse } from 'next/server'

export async function GET() {
  const requiredVars = {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    ENCRYPTION_KEY_BASE64: process.env.ENCRYPTION_KEY_BASE64,
  }

  const missingVars = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key)

  const hasAllVars = missingVars.length === 0

  return NextResponse.json({
    hasAllRequiredVars: hasAllVars,
    missingVars,
    vars: hasAllVars ? {
      GOOGLE_CLIENT_ID: requiredVars.GOOGLE_CLIENT_ID?.slice(0, 10) + '...',
      GOOGLE_CLIENT_SECRET: requiredVars.GOOGLE_CLIENT_SECRET ? '***set***' : 'missing',
      GOOGLE_REDIRECT_URI: requiredVars.GOOGLE_REDIRECT_URI,
      ENCRYPTION_KEY_BASE64: requiredVars.ENCRYPTION_KEY_BASE64 ? '***set***' : 'missing',
    } : null
  })
}
