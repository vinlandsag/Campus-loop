import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventListCard } from '@/components/events/EventListCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { cn } from '@/lib/utils'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { isEventPast } from '@/lib/utils/date'
import { buildTicketData } from '@/lib/tickets/service'
import { MyEventTicketButton } from '@/components/events/MyEventTicketButton'
import { MyEventFeedbackButton } from '@/components/events/MyEventFeedbackButton'
import { CertificateClaimButton } from '@/components/events/CertificateClaimButton'
import { getUserVolunteerSignups } from '@/app/actions/volunteer.actions'
import { HeartHandshake, Radio, Camera, Clock, CheckCircle2 } from 'lucide-react'
import type { Database } from '@/types/database.types'
import type { TicketData, RegistrationStatus, EventFeedback, AttendanceVisibility } from '@/types'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function MyEventsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const resolvedParams = await searchParams
  const activeTab = resolvedParams.tab || 'upcoming'

  if (!user) {
    redirect('/login')
  }

  // Fetch user profile for ticket attendee name
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const attendeeName = profile?.full_name || user.user_metadata?.['full_name'] || 'Attendee'

  // Fetch all user registrations with event details
  const { data: registrations, error } = await supabase
    .from('registrations')
    .select(`
      *,
      event:events (*)
    `)
    .eq('user_id', user.id)
    .order('registered_at', { ascending: false })

  if (error) {
    console.error('Error fetching registrations:', error.message)
  }

  // Fetch user feedbacks for past events and volunteer signups
  const [userFeedbacksRes, volunteerSignupsRes] = await Promise.all([
    supabase.from('event_feedback').select('*').eq('user_id', user.id),
    getUserVolunteerSignups(),
  ])

  const userFeedbacks = userFeedbacksRes.data
  const volunteerSignups = volunteerSignupsRes.success ? (volunteerSignupsRes.data || []) : []

  const feedbackMap = new Map<string, EventFeedback>(
    (userFeedbacks || []).map((f) => [f.event_id, f as EventFeedback])
  )

  type RegistrationItem = Omit<Database['public']['Tables']['registrations']['Row'], 'status'> & {
    status?: RegistrationStatus | null
    event: Database['public']['Tables']['events']['Row']
    ticketData?: TicketData | null
    waitlistPosition?: number | null
  }

  const upcoming: RegistrationItem[] = []
  const waitlist: RegistrationItem[] = []
  const past: RegistrationItem[] = []
  const cancelled: RegistrationItem[] = []

  if (registrations) {
    // Process items in parallel
    const processed = await Promise.all(
      (registrations as unknown as RegistrationItem[]).map(async (reg) => {
        const event = reg.event
        if (!event) return null

        // If registration or event cancelled
        if (reg.status === 'cancelled' || event.status === 'cancelled') {
          return { item: reg, category: 'cancelled' as const }
        }

        // If waitlisted
        if (reg.status === 'waitlisted') {
          if (reg.waitlist_position) {
            reg.waitlistPosition = reg.waitlist_position
          } else {
            const { count } = await supabase
              .from('registrations')
              .select('*', { count: 'exact', head: true })
              .eq('event_id', event.id)
              .eq('status', 'waitlisted')
              .lte('registered_at', reg.registered_at)

            reg.waitlistPosition = count || 1
          }
          return { item: reg, category: 'waitlist' as const }
        }

        // Concluded / Completed
        const eventConcluded = isEventPast(event)
        if (event.status === 'completed' || eventConcluded) {
          return { item: reg, category: 'past' as const }
        }

        // Active upcoming: Build ticket data
        const startsAtFormatted = `${event.event_date} • ${event.start_time}`
        const ticket = await buildTicketData({
          eventId: event.id,
          eventSlug: event.slug,
          eventTitle: event.title,
          eventStartsAt: startsAtFormatted,
          eventLocation: event.location,
          studentId: user.id,
          attendeeName,
          registrationId: reg.id,
          status: (reg.status as RegistrationStatus) || 'registered',
          existingTicketCode: reg.ticket_code,
          attendanceVisibility: ((reg as unknown as { attendance_visibility?: AttendanceVisibility })
            .attendance_visibility || 'private') as AttendanceVisibility,
        })

        reg.ticketData = ticket
        return { item: reg, category: 'upcoming' as const }
      })
    )

    processed.forEach((entry) => {
      if (!entry) return
      if (entry.category === 'cancelled') cancelled.push(entry.item)
      else if (entry.category === 'waitlist') waitlist.push(entry.item)
      else if (entry.category === 'past') past.push(entry.item)
      else upcoming.push(entry.item)
    })
  }

  // Sort upcoming events to show soonest first
  upcoming.sort((a, b) => {
    return new Date(a.event.event_date).getTime() - new Date(b.event.event_date).getTime()
  })

  // Determine which list to show
  let currentList = upcoming
  if (activeTab === 'waitlist') currentList = waitlist
  if (activeTab === 'past') currentList = past
  if (activeTab === 'cancelled') currentList = cancelled

  const tabs = [
    { id: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { id: 'waitlist', label: 'Waitlist', count: waitlist.length },
    { id: 'past', label: 'Past', count: past.length },
    { id: 'volunteering', label: 'Volunteering', count: volunteerSignups.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelled.length },
  ]

  return (
    <SectionContainer className="py-10 md:py-16">
      <div className="mb-8 md:mb-12">
        <h1 className="font-display text-3xl font-bold text-[--text-primary] md:text-4xl">
          My Events
        </h1>
        <p className="mt-2 text-[--text-secondary]">
          Manage your registrations, admission passes, and waitlist positions.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex overflow-x-auto border-b border-[--border-subtle] pb-px no-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <Link
              key={tab.id}
              href={`/my-events?tab=${tab.id}`}
              className={cn(
                'relative flex items-center gap-2 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'text-[--accent-600]'
                  : 'text-[--text-secondary] hover:text-[--text-primary]'
              )}
            >
              {tab.label}
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  isActive
                    ? 'bg-[--accent-100] text-[--accent-700]'
                    : 'bg-[--bg-muted] text-[--text-secondary]'
                )}
              >
                {tab.count}
              </span>
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[--accent-500]" />
              )}
            </Link>
          )
        })}
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        {activeTab === 'volunteering' ? (
          volunteerSignups.length === 0 ? (
            <EmptyState
              title="No Volunteer Shifts"
              description="You have not signed up for any event volunteer roles yet."
              actionLabel="Browse Events"
              actionHref="/events"
            />
          ) : (
            <div className="space-y-4">
              {volunteerSignups.map((signup) => (
                <div
                  key={signup.id}
                  className="flex flex-col justify-between gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm sm:flex-row sm:items-center"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <HeartHandshake className="h-3 w-3" />
                        Volunteer Shift
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          signup.status === 'approved'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : signup.status === 'checked_in'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : signup.status === 'declined'
                            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {signup.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                        {signup.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <h3 className="font-display text-base font-bold text-[--text-primary]">
                      {signup.role?.title || 'Volunteer Role'}
                    </h3>

                    {signup.event && (
                      <p className="text-xs text-[--text-secondary]">
                        For{' '}
                        <Link
                          href={`/events/${signup.event.slug}`}
                          className="font-semibold text-[--text-primary] hover:underline"
                        >
                          {signup.event.title}
                        </Link>
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-[--text-muted]">
                      {signup.role?.shift_start && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          <span>
                            {new Date(signup.role.shift_start).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      )}
                      {signup.event?.location && (
                        <span>• {signup.event.location}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {signup.event && (
                      <Link
                        href={`/events/${signup.event.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted] px-3.5 py-1.5 text-xs font-semibold text-[--text-primary] hover:bg-[--border-subtle] transition-colors"
                      >
                        View Event Page →
                      </Link>
                    )}
                    <span className="text-[10px] text-[--text-muted]">
                      Applied {new Date(signup.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : currentList.length === 0 ? (
          <EmptyState
            title={`No ${activeTab} events`}
            description={
              activeTab === 'upcoming'
                ? "You haven't registered for any upcoming events yet."
                : activeTab === 'waitlist'
                  ? "You aren't on any waitlists right now."
                  : activeTab === 'past'
                    ? "You haven't attended any events yet."
                    : "You have no cancelled registrations."
            }
            actionLabel={activeTab === 'upcoming' || activeTab === 'waitlist' ? 'Browse Events' : undefined}
            actionHref="/events"
          />
        ) : (
          currentList.map((reg) => (
            <div key={reg.id} className="flex flex-col gap-2">
              <EventListCard
                id={reg.event.id}
                title={reg.event.title}
                slug={reg.event.slug}
                category={reg.event.category}
                event_date={reg.event.event_date}
                start_time={reg.event.start_time}
                location={reg.event.location}
                banner_url={reg.event.banner_url}
                statusLabel={
                  <div className="flex flex-col items-end gap-2">
                    {reg.status === 'cancelled' || reg.event.status === 'cancelled' ? (
                      <EventStatusBadge status="cancelled" />
                    ) : reg.status === 'waitlisted' ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        Waitlist #{reg.waitlistPosition ?? 1}
                      </span>
                    ) : reg.status === 'checked_in' || reg.checked_in_at ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Checked In
                      </span>
                    ) : activeTab === 'past' ? (
                      <EventStatusBadge status="completed" />
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
                        Registered
                      </span>
                    )}

                    {/* View Admission Pass Modal Button for upcoming */}
                    {activeTab === 'upcoming' && reg.ticketData && (
                      <MyEventTicketButton ticket={reg.ticketData} />
                    )}

                    {/* Certificate claim/view button for past events */}
                    {activeTab === 'past' && (
                      <CertificateClaimButton
                        eventId={reg.event.id}
                        eventTitle={reg.event.title}
                        isCheckedIn={reg.status === 'checked_in' || !!reg.checked_in_at}
                      />
                    )}

                    {/* Feedback button for past events */}
                    {activeTab === 'past' && (
                      <MyEventFeedbackButton
                        eventId={reg.event.id}
                        eventTitle={reg.event.title}
                        initialFeedback={feedbackMap.get(reg.event.id) || null}
                      />
                    )}

                    {/* Quick navigation links */}
                    <div className="flex items-center gap-2.5 pt-1">
                      <Link
                        href={`/events/${reg.event.slug}/live`}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                      >
                        <Radio className="h-3 w-3" />
                        <span>Live Board</span>
                      </Link>
                      {activeTab === 'past' && (
                        <Link
                          href={`/events/${reg.event.slug}/gallery`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple-600 hover:underline dark:text-purple-400"
                        >
                          <Camera className="h-3 w-3" />
                          <span>Gallery</span>
                        </Link>
                      )}
                    </div>

                    <span className="text-[10px] text-[--text-muted]">
                      {reg.status === 'waitlisted' ? 'Joined' : 'Registered'}{' '}
                      {new Date(reg.registered_at).toLocaleDateString()}
                    </span>
                  </div>
                }
              />
              {reg.status === 'waitlisted' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <span className="font-semibold">Queue Position #{reg.waitlistPosition}:</span>{' '}
                  You are next in line. If an attendee cancels, your spot will be automatically reserved and your ticket issued.
                </div>
              )}
              {reg.event.status === 'cancelled' && reg.event.cancellation_reason && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 px-4 py-2.5 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                  <span className="font-semibold">Cancellation Reason:</span> {reg.event.cancellation_reason}
                </div>
              )}
              {reg.event.status !== 'cancelled' && reg.event.change_notice && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                  <span className="font-semibold">Notice from Organizer:</span> {reg.event.change_notice}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </SectionContainer>
  )
}
