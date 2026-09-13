import { createBrowserClient } from '@supabase/ssr'

/**
 * Browser-side Supabase client.
 * Uses only the anon key — never the service-role key.
 * Safe to call in Client Components and hooks.
 */
export function createClient() {
  return createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  )
}
