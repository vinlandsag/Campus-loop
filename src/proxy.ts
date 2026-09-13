import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ORGANIZER_ROUTES } from '@/lib/constants'

export async function proxy(request: NextRequest) {
  // ── Guard: pass through if Supabase is not configured yet ──────────────────
  // This allows the app to run in UI-only mode during development before a
  // Supabase project is set up. Remove this block once .env.local is configured.
  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>
        ) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — must happen before any redirect logic
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from protected routes
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings') ||
    (pathname.startsWith('/organizer') && !pathname.startsWith('/organizers')) ||
    pathname.startsWith('/my-events') ||
    pathname.startsWith('/favorites')

  if (isProtected && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  // Enforce organizer role for dashboard and organizer routes
  const isOrganizerRoute =
    pathname.startsWith('/dashboard') ||
    (ORGANIZER_ROUTES.some((route) => pathname.startsWith(route)) && !pathname.startsWith('/organizers'))
  if (user && isOrganizerRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isOrganizer = profile?.role === 'organizer' || user.user_metadata?.['role'] === 'organizer'
    if (!isOrganizer) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/events'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
