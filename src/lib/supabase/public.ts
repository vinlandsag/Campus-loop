import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

let cachedPublicClient: SupabaseClient<Database> | null = null

/**
 * Creates or returns an unauthenticated Supabase client suitable for public/shared data queries.
 * DOES NOT touch next/headers (cookies), making it safe to execute inside Next.js cache scopes.
 * Uses only the public anonymous key — never the service role key.
 * Strictly subject to Supabase RLS public policies.
 */
export function createPublicClient(): SupabaseClient<Database> {
  if (cachedPublicClient) return cachedPublicClient

  const supabaseUrl = process.env['NEXT_PUBLIC_SUPABASE_URL']
  const supabaseAnonKey = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public configuration (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)')
  }

  cachedPublicClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return cachedPublicClient
}
