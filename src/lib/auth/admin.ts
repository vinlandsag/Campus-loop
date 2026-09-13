import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AdminAuditAction } from '@/types'

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

/**
 * Combined helper: gets the current user from Supabase auth and verifies admin status.
 * Returns the user if they are an admin, or null with an error message.
 */
export async function getAdminUser(
  supabase: SupabaseClient<Database>
): Promise<{ user: User; authorized: true } | { user: null; authorized: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, authorized: false, error: 'Not authenticated' }
  }

  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { user: null, authorized: false, error: 'Unauthorized: Administrator privileges required.' }
  }

  return { user, authorized: true }
}

/**
 * Record an admin action in the immutable audit log.
 * This should be called for every sensitive admin action.
 */
export async function logAdminAction(
  supabase: SupabaseClient<Database>,
  params: {
    adminId: string
    action: AdminAuditAction | string
    targetType: string
    targetId: string
    reason?: string | null
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  try {
    await supabase.from('admin_audit_log').insert({
      admin_id: params.adminId,
      action: params.action,
      target_type: params.targetType,
      target_id: params.targetId,
      reason: params.reason || null,
      metadata: (params.metadata as unknown as Database['public']['Tables']['admin_audit_log']['Row']['metadata']) ?? {},
    })
  } catch (err) {
    console.error('Failed to write admin audit log:', err)
    // Do not throw — audit failure should not block the action
    // but it should be logged and monitored
  }
}
