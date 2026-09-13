import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type Role = Database['public']['Enums']['user_role']

interface AuthGuardProps {
  children: React.ReactNode
  requireRole?: Role
  redirectTo?: string
}

/**
 * Server Component that guards its children based on authentication and role.
 * Useful for hiding specific UI sections (e.g. "Create Event" button) from students.
 */
export async function AuthGuard({
  children,
  requireRole,
  redirectTo,
}: AuthGuardProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (redirectTo) redirect(redirectTo)
    return null
  }

  if (requireRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, is_verified')
      .eq('id', user.id)
      .single()

    const hasRole =
      requireRole === 'organizer'
        ? profile?.role === 'organizer' && Boolean(profile?.is_verified)
        : profile?.role === requireRole

    if (!hasRole) {
      if (redirectTo) redirect(redirectTo)
      return null
    }
  }

  return <>{children}</>
}
