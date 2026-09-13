import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  MapPin,
  Users,
  CheckCircle2,
  GraduationCap,
  Clock,
  ExternalLink,
  Briefcase,
  Sparkles,
  HelpCircle,
  Accessibility,
  AlertTriangle,
  Repeat,
  Radio,
  Camera,
  Award,
} from 'lucide-react'
import { isEventPast } from '@/lib/utils/date'

import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventStatusBadge } from '@/components/events/EventStatusBadge'
import { RegistrationButton, type RegistrationState } from '@/components/events/RegistrationButton'
import { TeamRegistrationCard } from '@/components/events/TeamRegistrationCard'
import { VolunteerOpportunitiesSection } from '@/components/events/VolunteerOpportunitiesSection'
import { ShareEvent } from '@/components/events/ShareEvent'
import { FavoriteButton } from '@/components/events/FavoriteButton'
import { ReportButton } from '@/components/moderation/ReportButton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { buildTicketData } from '@/lib/tickets/service'
import { getEventQuestions } from '@/app/actions/question.actions'
import { getUserTeamForEvent } from '@/app/actions/team-registration.actions'
import { getEventVolunteerRoles, getUserVolunteerSignups } from '@/app/actions/volunteer.actions'
import { getEventCertificateConfig } from '@/app/actions/certificate.actions'
import { EventVenueMap } from '@/components/events/EventVenueMap'
import { EventContentDisplay } from '@/components/events/EventContentDisplay'
import type { TicketData, EventAgendaItem, EventSpeaker, EventRegistrationTeam, EventTranslation } from '@/types'
import { cn } from '@/lib/utils'

type PageProps = {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ team_code?: string }>
}

export default async function EventDetailPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const slug = resolvedParams.slug
  const initialTeamCode = resolvedSearchParams?.team_code || ''
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Fetch Event with relations
  const { data: event } = await supabase
    .from('events')
    .select(`
      *,
      registrations(count)
    `, { count: 'exact' })
    .eq('slug', slug)
    .single()

  if (!event) {
    notFound()
  }

  // 1a. Safe Campus data lookup
  let campus: { name: string; slug: string } | null = null
  const campusId = (event as unknown as { campus_id?: string | null }).campus_id
  if (campusId) {
    try {
      const { data: campusData } = await supabase
        .from('campuses')
        .select('name, slug')
        .eq('id', campusId)
        .maybeSingle()
      campus = campusData
    } catch {}
  }

  // 1b. Safe public organizer data path
  let organizer: { full_name: string; avatar_url: string | null; is_verified?: boolean } | null = null
  if (event.organizer_id) {
    try {
      const { data: orgData, error: orgErr } = await supabase
        .from('organizer_profiles')
        .select('full_name, avatar_url, is_verified')
        .eq('id', event.organizer_id)
        .maybeSingle()
      if (!orgErr && orgData) {
        organizer = orgData
      }
    } catch {}

    if (!organizer) {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', event.organizer_id)
          .maybeSingle()
        if (pData) {
          organizer = {
            full_name: pData.full_name || 'Campus Organizer',
            avatar_url: pData.avatar_url,
            is_verified: false,
          }
        }
      } catch {}
    }
  }

  // 1c. Event Series lookup if part of a recurring series
  let series: { id: string; title: string; slug: string } | null = null
  if (event.series_id) {
    try {
      const { data: seriesData } = await supabase
        .from('event_series')
        .select('id, title, slug')
        .eq('id', event.series_id)
        .maybeSingle()
      series = seriesData
    } catch {}
  }

  // 1d. Team lookup if team registration is enabled
  let userTeam: EventRegistrationTeam | null = null
  if (user && (event.registration_mode === 'team' || event.registration_mode === 'both')) {
    try {
      const teamRes = await getUserTeamForEvent(event.id)
      if (teamRes.success && teamRes.team) {
        userTeam = teamRes.team
      }
    } catch {}
  }

  // 1e. Translations lookup (Phase 15)
  let translations: EventTranslation[] = []
  try {
    const { data: transData } = await supabase
      .from('event_translations')
      .select('*')
      .eq('event_id', event.id)
    translations = (transData as EventTranslation[]) || []
  } catch {}

  // Date Parsing
  let formattedDate = event.event_date
  let formattedTime = event.start_time
  let formattedEndTime = event.end_time
  const eventIsPast = isEventPast(event)

  try {
    const dateObj = parseISO(event.event_date)
    formattedDate = format(dateObj, 'EEEE, MMMM d, yyyy')

    const [hStart, mStart] = event.start_time.split(':')
    const startObj = new Date()
    startObj.setHours(parseInt(hStart || '0', 10), parseInt(mStart || '0', 10))
    formattedTime = format(startObj, 'h:mm a')

    const [hEnd, mEnd] = event.end_time.split(':')
    const endObj = new Date()
    endObj.setHours(parseInt(hEnd || '0', 10), parseInt(mEnd || '0', 10))
    formattedEndTime = format(endObj, 'h:mm a')
  } catch {}

  // Registration Deadline check
  let isDeadlinePassed = false
  let formattedDeadline = ''
  if (event.registration_deadline) {
    try {
      const deadlineDate = parseISO(event.registration_deadline)
      formattedDeadline = format(deadlineDate, 'MMM d, yyyy • h:mm a')
      if (new Date() > deadlineDate) {
        isDeadlinePassed = true
      }
    } catch {}
  }

  // 2. Compute Registration & Attendance State
  let isRegistered = false
  let isCheckedIn = false
  let isWaitlisted = false
  let waitlistPosition: number | null = null
  let ticketData: TicketData | null = null
  let isFavorited = false

  if (user) {
    const [regRes, favRes] = await Promise.all([
      supabase
        .from('registrations')
        .select('*')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('favorites')
        .select('id')
        .match({ event_id: event.id, user_id: user.id })
        .maybeSingle(),
    ])

    const reg = regRes.data
    isFavorited = !!favRes.data

    if (reg) {
      if (reg.status === 'registered' || reg.status === 'checked_in') {
        isRegistered = true
        isCheckedIn = reg.status === 'checked_in'
        try {
          ticketData = await buildTicketData({
            eventId: event.id,
            eventSlug: event.slug,
            eventTitle: event.title,
            eventStartsAt: `${formattedDate} • ${formattedTime}`,
            eventLocation: event.location,
            campusName: campus?.name || null,
            studentId: user.id,
            registrationId: reg.id,
            existingTicketCode: reg.ticket_code,
            attendeeName: user.user_metadata?.full_name || user.email || 'Attendee',
            status: reg.status,
            checkedInAt: reg.checked_in_at,
          })
        } catch (err) {
          console.error('Ticket generation error:', err)
        }
      } else if (reg.status === 'waitlisted') {
        isWaitlisted = true
        waitlistPosition = reg.waitlist_position ?? null
      }
    }
  }

  // Capacity & Remaining spots
  const capacity = event.capacity
  const currentRegistrations =
    event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
  const spotsLeft = capacity !== null ? Math.max(0, capacity - currentRegistrations) : null
  const isFull = spotsLeft === 0

  // Count active waitlisted attendees
  let waitlistCount = 0
  if (isFull) {
    try {
      const { count: wCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', event.id)
        .eq('status', 'waitlisted')
      waitlistCount = wCount || 0
    } catch {}
  }

  // Fetch Questions, Volunteer Opportunities, Certificates, and Counts in Parallel
  const [
    { questions: eventQuestions },
    volunteerRolesRes,
    userSignupsRes,
    certificateConfigRes,
    photoCountRes,
    announcementCountRes,
  ] = await Promise.all([
    getEventQuestions(event.id),
    getEventVolunteerRoles(event.id),
    user ? getUserVolunteerSignups() : Promise.resolve({ success: true, data: [] }),
    getEventCertificateConfig(event.id),
    supabase.from('event_photos').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
    supabase.from('event_announcements').select('id', { count: 'exact', head: true }).eq('event_id', event.id),
  ])

  const volunteerRoles = volunteerRolesRes.success ? (volunteerRolesRes.data || []) : []
  const userSignups = userSignupsRes.success ? (userSignupsRes.data || []) : []
  const certificateConfig = certificateConfigRes.success ? certificateConfigRes.data : null
  const photoCount = photoCountRes.count || 0
  const announcementCount = announcementCountRes.count || 0

  let registrationState: RegistrationState = 'eligible'
  if (event.status === 'cancelled') {
    registrationState = 'cancelled'
  } else if (eventIsPast || (isDeadlinePassed && !isRegistered)) {
    registrationState = 'ended'
  } else if (!user) {
    registrationState = 'logged_out'
  } else if (isCheckedIn) {
    registrationState = 'checked_in'
  } else if (isRegistered) {
    registrationState = 'registered'
  } else if (isWaitlisted) {
    registrationState = 'waitlisted'
  } else if (isFull) {
    registrationState = 'full'
  }

  // Phase 7 Structured Data parsing
  const agendaItems = (event.agenda as unknown as EventAgendaItem[]) || []
  const speakerItems = (event.speakers as unknown as EventSpeaker[]) || []

  return (
    <article className="min-h-screen pb-16">
      {/* ── Banner Section ─────────────────────────────────────────────────── */}
      <div className="relative aspect-[21/9] w-full max-h-[480px] min-h-[260px] bg-[--bg-muted] overflow-hidden border-b border-[--border-subtle]">
        {event.banner_url ? (
          <Image
            src={event.banner_url}
            alt={event.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[--accent-100] via-[--bg-muted] to-[--accent-50]">
            <Calendar className="h-20 w-20 text-[--accent-200]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      <SectionContainer as="div" className="relative -mt-12 sm:-mt-16 z-10">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
          {/* ── Main Content Column ────────────────────────────────────────── */}
          <div className="flex-1 space-y-8">
            {/* Title & Status Badges */}
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span className="rounded-full bg-[--bg-surface] px-3.5 py-1 text-xs font-bold tracking-wide text-[--text-primary] shadow-sm border border-[--border-subtle]">
                  {event.category}
                </span>

                {series && (
                  <Link
                    href={`/series/${series.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50/80 px-3 py-1 text-xs font-medium text-indigo-800 transition hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/40 dark:text-indigo-300"
                  >
                    <Repeat className="h-3 w-3" />
                    <span>Part of Series: {series.title}</span>
                    {event.series_sequence_index && (
                      <span className="font-semibold">• Session {event.series_sequence_index}</span>
                    )}
                  </Link>
                )}

                {campus && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[--accent-50] text-[--accent-700] dark:bg-[--accent-950]/50 dark:text-[--accent-300] px-3 py-1 text-xs font-semibold border border-[--accent-200] dark:border-[--accent-900]/60">
                    <GraduationCap className="h-3.5 w-3.5" />
                    <span>{campus.name}</span>
                  </span>
                )}

                <EventStatusBadge status={event.status} />

                {isRegistered && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 px-3 py-1 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>You&apos;re Registered</span>
                  </span>
                )}
                {isWaitlisted && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 px-3 py-1 text-xs font-semibold">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span>Waitlisted {waitlistPosition ? `(#${waitlistPosition})` : ''}</span>
                  </span>
                )}

                {announcementCount > 0 && (
                  <Link
                    href={`/events/${slug}/live`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50/80 px-3 py-1 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <Radio className="h-3 w-3 animate-pulse text-rose-600" />
                    <span>Live Updates ({announcementCount})</span>
                  </Link>
                )}

                {photoCount > 0 && (
                  <Link
                    href={`/events/${slug}/gallery`}
                    className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50/80 px-3 py-1 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/40 dark:text-purple-300"
                  >
                    <Camera className="h-3 w-3 text-purple-600" />
                    <span>Gallery ({photoCount})</span>
                  </Link>
                )}

                {certificateConfig?.is_enabled && (
                  <span
                    title={
                      certificateConfig.eligibility === 'checked_in'
                        ? 'Official certificate issued to checked-in attendees'
                        : 'Official certificate issued upon registration'
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/80 px-3 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <Award className="h-3 w-3 text-amber-600" />
                    <span>Verified Certificate</span>
                  </span>
                )}
              </div>

              {/* Cancellation Notice Banner */}
              {event.status === 'cancelled' && (
                <div className="mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>This event has been cancelled by the organizer</span>
                  </div>
                  {event.cancellation_reason && (
                    <p className="mt-1.5 text-xs text-rose-700 dark:text-rose-400">
                      <strong>Reason:</strong> {event.cancellation_reason}
                    </p>
                  )}
                </div>
              )}

              {/* Change Notice Banner */}
              {event.status !== 'cancelled' && event.change_notice && (
                <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-sm">
                    <span>📢 Notice of Event Update</span>
                    {event.rescheduled_at && (
                      <span className="text-xs font-normal text-amber-700 dark:text-amber-400">
                        (Rescheduled)
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                    {event.change_notice}
                  </p>
                </div>
              )}

              <EventContentDisplay
                initialTitle={event.title}
                initialDescription={event.description || ''}
                initialWhatToBring={event.what_to_bring}
                initialEligibility={event.eligibility}
                initialChangeNotice={event.change_notice}
                translations={translations}
              />
            </div>

            {/* Organizer Card (Clickable to Club Profile) */}
            <Link
              href={event.organizer_id ? `/organizers/${event.organizer_id}` : '#'}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 transition-all hover:border-[--border-strong] hover:shadow-sm group"
            >
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 border border-[--border-default] group-hover:scale-105 transition-transform">
                  <AvatarImage src={organizer?.avatar_url || ''} />
                  <AvatarFallback className="bg-[--accent-100] text-[--accent-700] font-bold">
                    {organizer?.full_name?.charAt(0) || 'O'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-medium text-[--text-muted]">Hosted by</p>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base font-bold text-[--text-primary] group-hover:text-[--accent-600] transition-colors">
                      {organizer?.full_name || 'Campus Organizer'}
                    </p>
                    {organizer?.is_verified && (
                      <span
                        title="Verified Organizer"
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-950/50 dark:text-blue-400"
                      >
                        <CheckCircle2 className="h-3 w-3 text-blue-500" />
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-[--accent-600] group-hover:translate-x-0.5 transition-transform hidden sm:inline-flex items-center gap-1">
                View Club Profile →
              </span>
            </Link>

            {/* Active Team Card */}
            {userTeam && (
              <div className="mb-6">
                <TeamRegistrationCard
                  team={userTeam}
                  eventSlug={slug}
                  minTeamSize={event.min_team_size || 2}
                  maxTeamSize={event.max_team_size || 4}
                  currentUserId={user?.id}
                />
              </div>
            )}

            {/* Eligibility & Attendance Criteria */}
            {event.eligibility && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/40 dark:bg-indigo-950/20 flex items-start gap-3">
                <GraduationCap className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                    Eligibility & Attendance Criteria
                  </h4>
                  <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200 font-medium leading-relaxed">
                    {event.eligibility}
                  </p>
                </div>
              </div>
            )}

            {/* Registration Deadline Alert */}
            {event.registration_deadline && (
              <div
                className={cn(
                  'rounded-2xl p-4 flex items-start gap-3 border text-xs leading-relaxed',
                  isDeadlinePassed
                    ? 'border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
                    : 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                )}
              >
                <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {isDeadlinePassed ? 'Registration Closed: ' : 'Registration Deadline: '}
                  </span>
                  <span>
                    {formattedDeadline}{' '}
                    {isDeadlinePassed
                      ? '(The registration deadline for this event has passed)'
                      : '(Be sure to RSVP before the cutoff)'}
                  </span>
                </div>
              </div>
            )}

            {/* Event Agenda / Schedule */}
            {agendaItems.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold text-[--text-primary] flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-[--accent-600]" />
                  <span>Event Schedule & Agenda</span>
                </h2>
                <div className="divide-y divide-[--border-subtle] rounded-2xl border border-[--border-subtle] bg-[--bg-surface] overflow-hidden">
                  {agendaItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-6 hover:bg-[--bg-muted]/30 transition-colors"
                    >
                      <span className="shrink-0 inline-flex items-center rounded-lg bg-[--bg-muted] px-2.5 py-1 text-xs font-bold text-[--accent-600] dark:text-[--accent-400] w-fit">
                        {item.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm sm:text-base font-bold text-[--text-primary]">
                          {item.title}
                        </h4>
                        {item.description && (
                          <p className="mt-1 text-xs sm:text-sm text-[--text-secondary] leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Featured Speakers & Guests */}
            {speakerItems.length > 0 && (
              <div className="space-y-4">
                <h2 className="font-display text-xl font-bold text-[--text-primary] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[--accent-600]" />
                  <span>Featured Speakers & Guests</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {speakerItems.map((speaker, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 flex items-start gap-3.5 shadow-sm"
                    >
                      <Avatar className="h-12 w-12 border border-[--border-default] shrink-0">
                        <AvatarImage src={speaker.avatar_url || ''} />
                        <AvatarFallback className="bg-[--accent-100] text-[--accent-700] font-bold">
                          {speaker.name?.charAt(0) || 'S'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-bold text-[--text-primary] truncate">
                          {speaker.name}
                        </h4>
                        {speaker.role && (
                          <p className="text-xs font-medium text-[--accent-600] dark:text-[--accent-400] truncate">
                            {speaker.role}
                          </p>
                        )}
                        {speaker.bio && (
                          <p className="mt-1 text-xs text-[--text-secondary] line-clamp-3 leading-relaxed">
                            {speaker.bio}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* What to Bring / Requirements */}
            {event.what_to_bring && (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[--text-primary] flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-[--accent-600]" />
                  <span>What to Bring / Requirements</span>
                </h2>
                <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 sm:p-5">
                  <p className="text-sm text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
                    {event.what_to_bring}
                  </p>
                </div>
              </div>
            )}

            {/* Accessibility & Accommodations */}
            {event.accessibility_notes && (
              <div className="space-y-3">
                <h2 className="font-display text-xl font-bold text-[--text-primary] flex items-center gap-2">
                  <Accessibility className="h-5 w-5 text-[--accent-600]" />
                  <span>Accessibility & Accommodations</span>
                </h2>
                <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 sm:p-5">
                  <p className="text-sm text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
                    {event.accessibility_notes}
                  </p>
                </div>
              </div>
            )}

            {/* Volunteer Opportunities Section */}
            {volunteerRoles.length > 0 && (
              <VolunteerOpportunitiesSection
                roles={volunteerRoles}
                userSignups={userSignups}
                isLoggedIn={!!user}
              />
            )}
          </div>

          {/* ── Sidebar ──────────────────────────────────────────────────────── */}
          <div className="w-full lg:w-80 xl:w-96">
            <div className="sticky top-24 space-y-6">
              {/* Registration Panel */}
              <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
                {/* Datetime / Location */}
                <div className="space-y-5 border-b border-[--border-subtle] pb-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[--bg-muted] text-[--text-primary]">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[--text-primary]">{formattedDate}</p>
                      <p className="text-sm text-[--text-secondary]">
                        {formattedTime} - {formattedEndTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[--bg-muted] text-[--text-primary]">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-[--text-primary]">{event.location}</p>
                      {event.map_url && (
                        <a
                          href={event.map_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[--accent-600] hover:underline"
                        >
                          <span>Get Directions / Map</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[--bg-muted] text-[--text-primary]">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-[--text-primary]">
                        {capacity === null ? 'Unlimited capacity' : `${capacity} Total Spots`}
                      </p>
                      <p className="text-sm text-[--text-secondary]">
                        {currentRegistrations} registered
                      </p>
                    </div>
                  </div>
                </div>

                {/* Registration Action */}
                <div className="pt-6">
                  {event.is_paid && event.price !== null && (
                    <div className="mb-4 text-center">
                      <span className="font-display text-3xl font-bold text-[--text-primary]">₹{event.price}</span>
                      <span className="text-sm text-[--text-muted]"> / ticket</span>
                    </div>
                  )}
                  {!event.is_paid && (
                    <div className="mb-4 text-center">
                      <span className="font-display text-2xl font-bold text-[--text-primary]">Free</span>
                    </div>
                  )}
                  <RegistrationButton
                    eventId={event.id}
                    slug={slug}
                    state={registrationState}
                    waitlistPosition={waitlistPosition}
                    ticket={ticketData}
                    isPaid={event.is_paid}
                    price={event.price}
                    questions={eventQuestions}
                    eventTitle={event.title}
                    registrationMode={event.registration_mode || 'individual'}
                    minTeamSize={event.min_team_size || 2}
                    maxTeamSize={event.max_team_size || 4}
                    userTeam={userTeam}
                    initialTeamCode={initialTeamCode}
                  />

                  {capacity !== null && !isFull && !isDeadlinePassed && (
                    <p className="mt-3 text-center text-sm font-medium text-[--accent-600]">
                      Only {spotsLeft} spots remaining!
                    </p>
                  )}
                  {isFull && waitlistCount > 0 && (
                    <p className="mt-3 text-center text-xs font-medium text-amber-600 dark:text-amber-400">
                      {waitlistCount} {waitlistCount === 1 ? 'student' : 'students'} on waitlist
                    </p>
                  )}
                  {isDeadlinePassed && !isRegistered && (
                    <p className="mt-3 text-center text-xs font-semibold text-rose-600">
                      Registration is closed (deadline passed)
                    </p>
                  )}
                </div>
              </div>

              {/* Structured Venue & Interactive Map Preview (Phase 15) */}
              <EventVenueMap
                location={event.location}
                building={event.building}
                floor={event.floor}
                room={event.room}
                latitude={event.latitude}
                longitude={event.longitude}
                accessibilityDetails={event.accessibility_details || event.accessibility_notes}
                directionsUrl={event.directions_url || event.map_url}
                eventTitle={event.title}
              />

              {/* Organizer Direct Contact Box */}
              {event.contact_method && (
                <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 text-xs space-y-1">
                  <span className="font-bold text-[--text-primary] flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-zinc-500" />
                    Questions about this event?
                  </span>
                  <p className="text-[--text-secondary] leading-relaxed">{event.contact_method}</p>
                </div>
              )}

              {/* Actions Panel */}
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <ShareEvent
                  id={event.id}
                  title={event.title}
                  description={event.description}
                  location={event.location}
                  eventDate={event.event_date}
                  startTime={event.start_time}
                  endTime={event.end_time}
                  startsAt={event.starts_at}
                  endsAt={event.ends_at}
                  timezone={event.timezone}
                  sequence={event.reschedule_count}
                />
                <FavoriteButton
                  eventId={event.id}
                  slug={slug}
                  isFavorited={isFavorited}
                  isAuthenticated={!!user}
                />
                <Link
                  href={`/events/${slug}/networking`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 py-2.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
                >
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                  <span>Attendee Networking Hub</span>
                </Link>
                <Link
                  href={`/events/${slug}/live`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 py-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                >
                  <Radio className="h-3.5 w-3.5 animate-pulse text-rose-600" />
                  <span>Live Announcements Board</span>
                </Link>
                <Link
                  href={`/events/${slug}/gallery`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 py-2.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/30 dark:text-purple-300"
                >
                  <Camera className="h-3.5 w-3.5 text-purple-600" />
                  <span>Curated Photo Gallery</span>
                </Link>
                <ReportButton
                  targetType="event"
                  targetId={event.id}
                  targetTitle={event.title}
                  variant="outline"
                  className="w-full justify-center text-xs text-zinc-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50"
                />
              </div>
            </div>
          </div>
        </div>
      </SectionContainer>
    </article>
  )
}
