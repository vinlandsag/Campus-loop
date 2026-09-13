import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * Validates if the authenticated user is an authorized system administrator.
 *
 * SECURITY INVARIANT:
 * Client-controllable user_metadata (e.g. `auth.jwt()->user_metadata->role = 'admin'`
 * or `user.user_metadata?.role`) is NEVER trusted.
 *
 * Administration is strictly granted via:
 * 1. Server-controlled app_metadata (e.g. `app_metadata.role === 'admin'` or `app_metadata.is_admin === true`)
 *    which normal users cannot modify via client-side Auth APIs.
 * 2. Dedicated `system_admins` database table with locked-down RLS.
 */
export async function isSystemAdmin(
  supabase: SupabaseClient<Database>,
  user: User | null | undefined
): Promise<boolean> {
  if (!user || !user.id) {
    return false
  }

  // 1. Check server-controlled app_metadata (immutable by normal users)
  const appMeta = user.app_metadata as Record<string, unknown> | undefined
  if (appMeta?.['role'] === 'admin' || appMeta?.['is_admin'] === true) {
    return true
  }

  // 2. Query dedicated system_admins table
  try {
    const { data, error } = await supabase
      .from('system_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!error && data) {
      return true
    }
  } catch (err) {
    console.error('Error checking system_admins status:', err)
  }

  return false
}

/**
 * Enforce administrator access in server actions or route handlers.
 * Fails closed if not authenticated or not an admin.
 */
export async function assertAdmin(
  supabase: SupabaseClient<Database>,
  user: User | null | undefined
): Promise<{ authorized: boolean; error?: string }> {
  if (!user) {
    return { authorized: false, error: 'Not authenticated' }
  }

  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { authorized: false, error: 'Unauthorized: Administrator privileges required.' }
  }

  return { authorized: true }
}
