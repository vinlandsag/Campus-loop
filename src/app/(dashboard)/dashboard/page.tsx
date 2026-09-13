import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { CalendarDays, Users, CalendarPlus, UserCheck, TrendingUp, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import { isEventPast } from '@/lib/utils/date'
import { getOrganizerOverviewMetrics } from '@/app/actions/analytics.actions'
import type { Database } from '@/types/database.types'

type DashboardEvent = Database['public']['Tables']['events']['Row'] & {
  registrations?: { count: number }[]
}

export default async function DashboardOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch caller profile for verification status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified, campus_id, campus_verification_status, campus_exception_reason')
    .eq('id', user.id)
    .maybeSingle()

  // Fetch assigned team events IDs
  const { data: teamMemberships } = await supabase
    .from('event_team_members')
    .select('event_id')
    .eq('user_id', user.id)

  const teamEventIds = (teamMemberships || []).map((t) => t.event_id)

  // Fetch owned events OR assigned team events
  let eventsQuery = supabase
    .from('events')
    .select('*, registrations(count)')
    .order('created_at', { ascending: false })

  if (teamEventIds.length > 0) {
    eventsQuery = eventsQuery.or(`organizer_id.eq.${user.id},id.in.(${teamEventIds.join(',')})`)
  } else {
    eventsQuery = eventsQuery.eq('organizer_id', user.id)
  }

  const [eventsResult, overviewMetrics] = await Promise.all([
    eventsQuery,
    getOrganizerOverviewMetrics(),
  ])

  const events = eventsResult.data
  const error = eventsResult.error

  if (error) {
    console.error('Dashboard overview error:', error.message)
  }

  const allEvents = (events || []) as unknown as DashboardEvent[]
  const recentEvents = allEvents.slice(0, 5)

  // Compute metrics
  const totalEvents = allEvents.length
  const totalParticipants = allEvents.reduce(
    (sum, e) => sum + (e.active_registrations_count ?? (e.registrations?.[0]?.count || 0)),
    0
  )
  const upcomingEvents = allEvents.filter(
    (e) => !isEventPast(e) && e.status !== 'cancelled'
  ).length

  const stats = [
    { label: 'Total Events', value: totalEvents, icon: CalendarDays },
    { label: 'Registrations', value: totalParticipants, icon: Users },
    { label: 'Checked In', value: overviewMetrics.totalCheckedIn, icon: UserCheck },
    { label: 'Turnout Rate', value: `${overviewMetrics.overallAttendanceRate}%`, icon: TrendingUp },
    { label: 'Waitlist Converted', value: overviewMetrics.totalWaitlistConversions, icon: CheckCircle2 },
    { label: 'Upcoming', value: upcomingEvents, icon: CalendarPlus },
  ]

  const isOrganizer = profile?.role === 'organizer'
  const isVerifiedOrganizer = isOrganizer && Boolean(profile?.is_verified)
  const isPendingOrganizer = isOrganizer && !profile?.is_verified
  const isUnverifiedCampus = profile?.campus_verification_status === 'unverified'
  const isPendingCampus = profile?.campus_verification_status === 'pending'

  return (
    <div className="space-y-6">
      {/* Verification Status Notice Banners */}
      {isPendingOrganizer && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Organizer Account Pending Verification</p>
              <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                Your campus club organizer account is currently in review by administrators. You can join event teams as staff immediately, and you will be able to create and publish campus events once verified.
              </p>
            </div>
          </div>
        </div>
      )}

      {isUnverifiedCampus && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Campus Email Verification Required</p>
              <p className="mt-0.5 text-xs text-blue-700 dark:text-blue-300">
                Please confirm your university email address to activate your full campus membership and verified club privileges.
              </p>
            </div>
          </div>
        </div>
      )}

      {isPendingCampus && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/80 p-4 text-purple-900 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-200">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Campus Exception Request Pending</p>
              <p className="mt-0.5 text-xs text-purple-700 dark:text-purple-300">
                Your cross-campus affiliation request is under administrative review. Once approved, you will have verified access to this campus.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary]">Overview</h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Your event management and real-time operations at a glance.
          </p>
        </div>
        {isVerifiedOrganizer ? (
          <Link
            href="/dashboard/events/new"
            className={cn(buttonVariants({ variant: 'default', size: 'default' }), 'gap-2')}
          >
            <CalendarPlus className="h-4 w-4" />
            Create Event
          </Link>
        ) : (
          <div className="text-xs text-zinc-500 italic">
            Event creation available upon organizer verification
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 sm:gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <stat.icon className="h-[18px] w-[18px] text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="min-w-0">
                <p className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  {stat.value}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent events */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Recent Events
          </h2>
          {allEvents.length > 5 && (
            <Link
              href="/dashboard/events"
              className="text-sm font-medium text-amber-600 hover:text-amber-700"
            >
              View all →
            </Link>
          )}
        </div>

        {recentEvents.length === 0 ? (
          <EmptyState
            title="No events yet"
            description="Create your first event to get started."
            actionLabel="Create Event"
            actionHref="/dashboard/events/new"
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60">
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[--text-secondary]">
                      Title
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[--text-secondary]">
                      Status
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[--text-secondary]">
                      Date
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[--text-secondary]">
                      Price
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left font-medium text-[--text-secondary]">
                      Participants
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-right font-medium text-[--text-secondary]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[--border-subtle]">
                  {recentEvents.map((event) => {
                    let dateStr = event.event_date
                    try {
                      dateStr = format(parseISO(event.event_date), 'MMM d, yyyy')
                    } catch {}

                    const regCount = event.registrations?.[0]?.count || 0

                    return (
                      <tr key={event.id} className="transition-colors hover:bg-[--bg-muted]/50">
                        <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[--text-primary]">
                          {event.title}
                        </td>
                        <td className="px-4 py-3">
                          <EventStatusBadge status={event.status} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[--text-secondary]">
                          {dateStr}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-[--text-primary]">
                          {event.is_paid && event.price !== null && event.price > 0 ? `₹${event.price}` : 'Free'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-[--text-secondary]">
                          {regCount}{event.capacity ? `/${event.capacity}` : ''}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              href={`/dashboard/events/${event.id}/participants`}
                              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                            >
                              Participants
                            </Link>
                            <Link
                              href={`/dashboard/events/${event.id}/analytics`}
                              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                            >
                              Analytics
                            </Link>
                            <Link
                              href={`/dashboard/events/${event.id}/edit`}
                              className="text-xs font-medium text-[--accent-600] hover:text-[--accent-700]"
                            >
                              Edit
                            </Link>
                            <Link
                              href={`/events/${event.slug}`}
                              className="text-xs font-medium text-[--text-secondary] hover:text-[--text-primary]"
                            >
                              View
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
