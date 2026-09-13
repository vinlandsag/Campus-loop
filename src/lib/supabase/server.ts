import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { measureDevPerf } from '@/lib/diagnostics/perf'

/**
 * Server-side Supabase client.
 * Reads session from httpOnly cookies via next/headers.
 * Must only be called from Server Components, Server Actions, and Route Handlers.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const client = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(
          cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll is called from a Server Component; cookies are read-only there.
            // The middleware handles cookie refresh instead.
          }
        },
      },
    }
  )

  if (process.env.NODE_ENV === 'development') {
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = ((jwt?: string) => {
      return measureDevPerf('auth:lookup', () => originalGetUser(jwt))
    }) as typeof client.auth.getUser
  }

  return client
}
