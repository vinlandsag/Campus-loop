import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { APP_NAME } from '@/lib/constants'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { measureDevPerf } from '@/lib/diagnostics/perf'
import type { CampusVerificationStatus } from '@/types'

export const metadata: Metadata = {
  title: `Dashboard — ${APP_NAME}`,
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({ children }: DashboardLayoutProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Verify organizer role or scoped team membership
  const { data: profile } = await measureDevPerf('profile:role_lookup', () =>
    supabase
      .from('profiles')
      .select('role, full_name, is_verified, campus_id, campus_verification_status')
      .eq('id', user.id)
      .maybeSingle()
  )

  let isOrganizer = profile?.role === 'organizer'
  if (!isOrganizer && user.user_metadata?.['role'] === 'organizer') {
    await supabase.from('profiles').update({ role: 'organizer' }).eq('id', user.id)
    isOrganizer = true
  }

  // Check if user is a member of any event team
  const { count: teamCount } = await supabase
    .from('event_team_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const isTeamMember = (teamCount ?? 0) > 0

  if (!isOrganizer && !isTeamMember) {
    redirect('/')
  }

  let campusName: string | undefined = undefined
  let campusStatus = (profile?.campus_verification_status as CampusVerificationStatus) || 'unverified'
  if (profile?.campus_id) {
    const { data: campus } = await measureDevPerf('campus:lookup', () =>
      supabase
        .from('campuses')
        .select('name, approved_domains')
        .eq('id', profile.campus_id)
        .maybeSingle()
    )
    campusName = campus?.name

    // If unverified but user's email matches an approved domain for this campus, auto-verify!
    if (campusStatus === 'unverified' && campus?.approved_domains && user.email) {
      const domain = user.email.split('@')[1]?.toLowerCase()
      if (domain && campus.approved_domains.some((d: string) => d.toLowerCase() === domain)) {
        await supabase
          .from('profiles')
          .update({
            campus_verification_status: 'verified',
            campus_verified_at: new Date().toISOString(),
          })
          .eq('id', user.id)
        campusStatus = 'verified'
      }
    }
  }

  const fullName = profile?.full_name || (user.user_metadata?.['full_name'] as string) || ''
  const initials = fullName
    ? fullName
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <DashboardShell
      user={{
        fullName,
        email: user.email || '',
        initials,
        isOrganizer,
        isVerified: Boolean(profile?.is_verified),
        campusName,
        campusStatus,
      }}
    >
      {children}
    </DashboardShell>
  )
}
