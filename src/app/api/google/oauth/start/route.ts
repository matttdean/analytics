import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

function b64url(bytes: Uint8Array) {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function GET() {
  const client_id = process.env.GOOGLE_CLIENT_ID!
  const redirect_uri = process.env.GOOGLE_REDIRECT_URI!  // http://localhost:3000/api/google/oauth/callback
  const scopes = [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/business.manage',
    'https://www.googleapis.com/auth/plus.business.manage',
    'https://www.googleapis.com/auth/plus.me'
  ].join(' ')

  // CSRF state cookie
  const state = b64url(crypto.getRandomValues(new Uint8Array(24)))
  const jar = await cookies()
  jar.set({
    name: 'google_oauth_state',
    value: state,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
    secure: process.env.NODE_ENV === 'production',
  })

  const params = new URLSearchParams({
    client_id,
    redirect_uri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',         // mint refresh_token
    prompt: 'consent',              // force refresh_token on repeat consent
    include_granted_scopes: 'true', // optional but nice
    state,
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  )
}
