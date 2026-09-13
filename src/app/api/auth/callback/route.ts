import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { APP_URL } from '@/lib/constants'

/**
 * Supabase Auth callback handler.
 * Exchanges a PKCE code (from magic link or OAuth) for a session.
 * The `next` query param is used for post-login redirects and validated
 * against the APP_URL to prevent open-redirect attacks.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Validate redirect target is on the same origin (prevent open redirect)
  const redirectTo = next.startsWith('/') ? `${origin}${next}` : APP_URL

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }
  }

  // If code exchange failed, redirect to login with an error indicator
  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', 'auth_callback_failed')
  return NextResponse.redirect(loginUrl)
}
