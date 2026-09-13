import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { CalendarPlus, Eye, Pencil, Users, QrCode, ShieldCheck, HelpCircle, Megaphone, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { DeleteEventButton } from '@/components/dashboard/DeleteEventButton'
import { CancelEventDialog } from '@/components/dashboard/CancelEventDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  canEditEvent,
  canManageTeam,
  canManageQuestions,
  canSendAnnouncements,
  canCheckIn,
  canViewParticipants,
  canViewAnalytics,
  canCancelEvent,
  canDeleteEvent,
} from '@/lib/auth/teams'
import type { EventTeamRole } from '@/types'
import type { Database } from '@/types/database.types'

type EventListItem = Database['public']['Tables']['events']['Row'] & {
  registrations?: { count: number }[]
}

export default async function DashboardEventsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch caller's profile to verify organizer status
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified, campus_verification_status')
    .eq('id', user.id)
    .maybeSingle()

  const isVerifiedOrganizer =
    profile?.role === 'organizer' &&
    Boolean(profile?.is_verified) &&
    profile?.campus_verification_status === 'verified'

  // Fetch assigned team memberships
  const { data: teamMemberships } = await supabase
    .from('event_team_members')
    .select('event_id, role')
    .eq('user_id', user.id)

  const teamRoleMap = new Map<string, EventTeamRole>()
  const teamEventIds: string[] = []
  if (teamMemberships) {
    for (const tm of teamMemberships) {
      teamRoleMap.set(tm.event_id, tm.role as EventTeamRole)
      teamEventIds.push(tm.event_id)
    }
  }

  // Query owned events OR events where user is a team member
  let eventsQuery = supabase
    .from('events')
    .select('*, registrations(count)')
    .order('created_at', { ascending: false })

  if (teamEventIds.length > 0) {
    eventsQuery = eventsQuery.or(`organizer_id.eq.${user.id},id.in.(${teamEventIds.join(',')})`)
  } else {
    eventsQuery = eventsQuery.eq('organizer_id', user.id)
  }

  const { data: events, error } = await eventsQuery

  if (error) {
    console.error('Events list error:', error.message)
  }

  const allEvents = (events || []) as unknown as EventListItem[]

  return (
    <div>
      {/* Page header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary]">My Events & Assignments</h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Manage your organized events and staff team assignments.
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
            Verified campus organizer status required to create events
          </div>
        )}
      </div>

      {allEvents.length === 0 ? (
        <EmptyState
          title="No events yet"
          description="Create your first event or join an event organizing team to get started."
          actionLabel={isVerifiedOrganizer ? "Create Event" : undefined}
          actionHref={isVerifiedOrganizer ? "/dashboard/events/new" : undefined}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60">
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Title
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    My Role
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Status
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Date
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Price
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Participants
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {allEvents.map((event) => {
                  let dateStr = event.event_date
                  try {
                    dateStr = format(parseISO(event.event_date), 'MMM d, yyyy')
                  } catch {}

                  const regCount =
                    event.active_registrations_count ?? event.registrations?.[0]?.count ?? 0

                  const role: EventTeamRole =
                    event.organizer_id === user.id
                      ? 'owner'
                      : teamRoleMap.get(event.id) || 'viewer'

                  const roleBadgeConfig: Record<EventTeamRole, { label: string; className: string }> = {
                    owner: { label: 'Owner', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800' },
                    editor: { label: 'Editor', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
                    check_in_staff: { label: 'Check-in Staff', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
                    viewer: { label: 'Viewer', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700' },
                  }

                  const badge = roleBadgeConfig[role]

                  return (
                    <tr key={event.id} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="max-w-[220px] truncate px-4 py-3.5 font-medium text-zinc-900 dark:text-zinc-100">
                        {event.title}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold border', badge.className)}>
                          {badge.label}
                        </span>
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
                        <div className="inline-flex items-center justify-end gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50/80 p-1.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/70">
                          {canEditEvent(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/edit`}
                              aria-label="Edit event"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-all hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                              title="Edit Event"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          <Link
                            href={`/events/${event.slug}`}
                            aria-label="View public page"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-all hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                            title="View public page"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                          {canViewParticipants(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/participants`}
                              aria-label="View participants"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-all hover:bg-white hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                              title="View participants"
                            >
                              <Users className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {canCheckIn(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/check-in`}
                              aria-label="Check in attendees"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600 transition-all hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-200"
                              title="Attendee Check-In Station"
                            >
                              <QrCode className="h-4 w-4" />
                            </Link>
                          )}
                          {canManageTeam(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/team`}
                              aria-label="Manage team"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-indigo-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-200"
                              title="Team Management"
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {canManageQuestions(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/questions`}
                              aria-label="Manage questions"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-all hover:bg-amber-50 hover:text-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-200"
                              title="Registration Questions"
                            >
                              <HelpCircle className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {canSendAnnouncements(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/announcements`}
                              aria-label="Send announcements"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 transition-all hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/50 dark:hover:text-rose-200"
                              title="Send Announcement"
                            >
                              <Megaphone className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {canViewAnalytics(role) && (
                            <Link
                              href={`/dashboard/events/${event.id}/analytics`}
                              aria-label="View analytics"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sky-600 transition-all hover:bg-sky-50 hover:text-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
                              title="Analytics & Attendance"
                            >
                              <BarChart2 className="h-3.5 w-3.5" />
                            </Link>
                          )}
                          {canCancelEvent(role) && (
                            <div className="inline-flex">
                              <CancelEventDialog
                                eventId={event.id}
                                eventTitle={event.title}
                                registrationCount={regCount}
                                isCancelled={event.status === 'cancelled'}
                              />
                            </div>
                          )}
                          {canDeleteEvent(role) && (
                            <div className="inline-flex">
                              <DeleteEventButton
                                eventId={event.id}
                                eventTitle={event.title}
                                registrationCount={regCount}
                              />
                            </div>
                          )}
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
  )
}

