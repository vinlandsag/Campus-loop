import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import { measureDevPerf } from '@/lib/diagnostics/perf'
import { APP_NAME } from '@/lib/constants'
import { AdminShell } from '@/components/admin/AdminShell'

export const metadata: Metadata = {
  title: `Admin — ${APP_NAME}`,
  robots: { index: false, follow: false },
}

interface AdminLayoutProps {
  children: React.ReactNode
}

/**
 * Server-side admin layout.
 * Enforces admin authorization before rendering any admin page.
 * Non-admins are silently redirected — no information leakage.
 */
export default async function AdminLayout({ children }: AdminLayoutProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not authenticated → redirect to admin login
  if (!user) {
    redirect('/admin/login')
  }

  // Authenticated but not admin → redirect to home (no leak)
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    redirect('/')
  }

  const { data: profile } = await measureDevPerf('profile:role_lookup', () =>
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
  )

  const fullName = profile?.full_name || user.email || 'Admin'
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <AdminShell
      admin={{
        fullName,
        email: user.email || '',
        initials,
      }}
    >
      {children}
    </AdminShell>
  )
}
