import { createBrowserClient } from '@supabase/ssr'
import { measureDevPerf } from '@/lib/diagnostics/perf'

/**
 * Browser-side Supabase client.
 * Uses only the anon key — never the service-role key.
 * Safe to call in Client Components and hooks.
 */
export function createClient() {
  const client = createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  )

  if (process.env.NODE_ENV === 'development') {
    const originalGetUser = client.auth.getUser.bind(client.auth)
    client.auth.getUser = ((jwt?: string) => {
      return measureDevPerf('auth:lookup', () => originalGetUser(jwt))
    }) as typeof client.auth.getUser
  }

  return client
}
