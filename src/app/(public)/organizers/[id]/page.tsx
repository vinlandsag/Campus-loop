import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { startOfToday } from 'date-fns'
import {
  CheckCircle2,
  GraduationCap,
  Mail,
  Globe,
  Instagram,
  Calendar,
  Users,
  Award,
  ArrowLeft,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { getCachedPublicOrganizer } from '@/lib/cache/public-cache'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { EventCard } from '@/components/events/EventCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ReportButton } from '@/components/moderation/ReportButton'
import { ClubFollowButton } from '@/components/social/ClubFollowButton'
import { getOrganizerFollowStats } from '@/app/actions/follow.actions'
import { getBatchEventsFriendAttendance } from '@/lib/social/attendance'
import { APP_NAME } from '@/lib/constants'
import type { OrganizerProfile, ConsentedFriendAttendance } from '@/types'
import type { Database } from '@/types/database.types'

type EventRow = Database['public']['Tables']['events']['Row'] & {
  registrations: { count: number }[]
  campus?: { id: string; name: string; slug: string } | null
}

interface OrganizerProfilePageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({
  params,
}: OrganizerProfilePageProps): Promise<Metadata> {
  const { id } = await params

  let fullName = ''
  let bio: string | null = null

  try {
    const org = await getCachedPublicOrganizer(id)
    if (org) {
      fullName = org.full_name || ''
      bio = org.bio || null
    }
  } catch {}

  if (!fullName) {
    return { title: `Club Profile — ${APP_NAME}` }
  }

  return {
    title: `${fullName} — Campus Club Profile | ${APP_NAME}`,
    description: bio || `Explore events and activities hosted by ${fullName} on CampusLoop.`,
  }
}

export default async function OrganizerProfilePage({
  params,
}: OrganizerProfilePageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 1. Fetch Verified Organizer Profile from public cache
  let organizer: OrganizerProfile | null = null

  try {
    const orgData = await getCachedPublicOrganizer(id)
    if (orgData && orgData.is_verified) {
      organizer = {
        id: orgData.id || id,
        full_name: orgData.full_name || 'Campus Organizer',
        avatar_url: orgData.avatar_url,
        bio: orgData.bio,
        website_url: orgData.website_url,
        instagram_handle: orgData.instagram_handle,
        contact_email: orgData.contact_email,
        campus_id: orgData.campus_id,
        college: orgData.college,
        department: orgData.department,
        is_verified: Boolean(orgData.is_verified),
        created_at: new Date().toISOString(),
      }
    }
  } catch {}

  if (!organizer) {
    notFound()
  }

  // 2. Fetch Campus Details if campus_id exists
  let campus: { name: string; slug: string } | null = null
  if (organizer.campus_id) {
    try {
      const { data: cData } = await supabase
        .from('campuses')
        .select('name, slug')
        .eq('id', organizer.campus_id)
        .maybeSingle()
      campus = cData
    } catch {}
  }

  // 3. Fetch All Published Events Hosted by this Organizer
  const { data: eventsData } = await supabase
    .from('events')
    .select('*, registrations(count)')
    .eq('organizer_id', id)
    .eq('status', 'published')
    .order('event_date', { ascending: false })

  const allEvents = (eventsData || []) as unknown as EventRow[]

  // Segregate into Upcoming vs Past Events
  const today = startOfToday()
  const todayStr = today.toISOString().split('T')[0] || ''

  const upcomingEvents = allEvents
    .filter((e) => e.event_date >= todayStr)
    .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time))

  const pastEvents = allEvents
    .filter((e) => e.event_date < todayStr)
    .sort((a, b) => b.event_date.localeCompare(a.event_date))

  // Compute Overall Impact Stats
  const totalEventsHosted = allEvents.length
  const totalAttendeesServed = allEvents.reduce(
    (acc, e) => acc + (e.active_registrations_count ?? (e.registrations?.[0]?.count || 0)),
    0
  )

  // Fetch Current User's Registrations & Favorites if Authenticated
  const favorites = new Set<string>()
  const userRegMap = new Map<string, { status: string; waitlist_position?: number | null }>()

  if (user && allEvents.length > 0) {
    const eventIds = allEvents.map((e) => e.id)
    const [favRes, regRes] = await Promise.all([
      supabase.from('favorites').select('event_id').eq('user_id', user.id).in('event_id', eventIds),
      supabase.from('registrations').select('event_id, status, waitlist_position').eq('user_id', user.id).in('event_id', eventIds),
    ])

    if (favRes.data) favRes.data.forEach((f) => favorites.add(f.event_id))
    if (regRes.data) {
      regRes.data.forEach((r) =>
        userRegMap.set(r.event_id, {
          status: r.status,
          waitlist_position: r.waitlist_position,
        })
      )
    }
  }

  // Phase 12: Club Follow Stats & Friend Attendance
  const [followStats, friendAttendanceMap] = await Promise.all([
    getOrganizerFollowStats(id),
    user && upcomingEvents.length > 0
      ? getBatchEventsFriendAttendance(upcomingEvents.map((e) => e.id))
      : Promise.resolve({} as Record<string, ConsentedFriendAttendance>),
  ])

  return (
    <SectionContainer as="div" className="py-8 space-y-10">
      {/* Back Link */}
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[--text-secondary] hover:text-[--text-primary] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to All Events</span>
        </Link>
      </div>

      {/* Organizer Hero Card */}
      <div className="rounded-3xl border border-[--border-subtle] bg-[--bg-surface] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <Avatar className="h-20 w-20 sm:h-24 sm:w-24 border-2 border-[--border-default] shadow-sm">
              <AvatarImage src={organizer.avatar_url || ''} alt={organizer.full_name} />
              <AvatarFallback className="bg-[--accent-100] text-2xl font-bold text-[--accent-700]">
                {organizer.full_name?.charAt(0) || 'C'}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[--text-primary]">
                  {organizer.full_name}
                </h1>
                {organizer.is_verified ? (
                  <Badge className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200">
                    <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                    <span>Verified Campus Organizer</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-zinc-500 text-xs">
                    Campus Club
                  </Badge>
                )}
              </div>

              {campus && (
                <div className="flex items-center gap-2 text-xs text-[--text-secondary]">
                  <span className="flex items-center gap-1 font-semibold text-[--accent-600] dark:text-[--accent-400]">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {campus.name}
                  </span>
                  {organizer.college && <span>• {organizer.college}</span>}
                  {organizer.department && <span>• {organizer.department}</span>}
                </div>
              )}

              {organizer.bio ? (
                <p className="max-w-2xl text-sm text-[--text-secondary] leading-relaxed pt-1">
                  {organizer.bio}
                </p>
              ) : (
                <p className="text-xs text-[--text-muted] italic pt-1">
                  Verified campus organization hosting events, workshops, and community meetups.
                </p>
              )}
            </div>
          </div>

          {/* Social / Contact Links */}
          <div className="flex flex-wrap items-center gap-2 sm:self-start">
            <ClubFollowButton
              organizerId={id}
              initialIsFollowing={followStats.isFollowing}
              initialNotify={followStats.notify}
              initialFollowerCount={followStats.followerCount}
              isVerified={organizer.is_verified}
              isOwnProfile={Boolean(user && user.id === id)}
            />
            {organizer.contact_email && (
              <a
                href={`mailto:${organizer.contact_email}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/60 px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-muted] transition-colors"
                title="Send inquiry email"
              >
                <Mail className="h-3.5 w-3.5 text-zinc-500" />
                <span>Contact Club</span>
              </a>
            )}
            {organizer.website_url && (
              <a
                href={organizer.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/60 px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-muted] transition-colors"
                title="Official Website"
              >
                <Globe className="h-3.5 w-3.5 text-zinc-500" />
                <span>Website</span>
              </a>
            )}
            {organizer.instagram_handle && (
              <a
                href={`https://instagram.com/${organizer.instagram_handle.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/60 px-3 py-1.5 text-xs font-medium text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-muted] transition-colors"
                title="Instagram"
              >
                <Instagram className="h-3.5 w-3.5 text-pink-500" />
                <span>{organizer.instagram_handle.startsWith('@') ? organizer.instagram_handle : `@${organizer.instagram_handle}`}</span>
              </a>
            )}
            <ReportButton
              targetType="organizer"
              targetId={organizer.id}
              targetTitle={organizer.full_name}
              variant="outline"
              size="sm"
              className="rounded-xl border-[--border-subtle] px-3 py-1.5 text-xs text-zinc-500 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900/50"
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[--border-subtle] pt-6 sm:grid-cols-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-[--text-primary]">{upcomingEvents.length}</p>
              <p className="text-xs text-[--text-muted]">Upcoming Events</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-[--text-primary]">{totalEventsHosted}</p>
              <p className="text-xs text-[--text-muted]">Total Events Hosted</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-[--text-primary]">{totalAttendeesServed}</p>
              <p className="text-xs text-[--text-muted]">Attendees Served</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-[--text-primary]">
                {organizer.is_verified ? 'Verified' : 'Member'}
              </p>
              <p className="text-xs text-[--text-muted]">Campus Standing</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Upcoming Events Section ─────────────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[--text-primary]">
              Upcoming Events ({upcomingEvents.length})
            </h2>
            <p className="text-sm text-[--text-secondary]">
              Upcoming schedule hosted by {organizer.full_name}.
            </p>
          </div>
        </div>

        {upcomingEvents.length === 0 ? (
          <EmptyState
            title="No upcoming events right now"
            description={`${organizer.full_name} does not currently have any events on the schedule. Check out their past event archive or explore other campus activities.`}
            actionLabel="Explore All Campus Events"
            actionHref="/events"
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {upcomingEvents.map((event) => {
              const reg = userRegMap.get(event.id)
              return (
                <EventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  slug={event.slug}
                  category={event.category}
                  event_date={event.event_date}
                  start_time={event.start_time}
                  location={event.location}
                  capacity={event.capacity}
                  banner_url={event.banner_url}
                  campus={campus}
                  organizer={{
                    full_name: organizer.full_name,
                    avatar_url: organizer.avatar_url,
                    is_verified: organizer.is_verified,
                  }}
                  organizer_id={organizer.id}
                  registrations_count={
                    event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
                  }
                  isAuthenticated={!!user}
                  isFavorited={favorites.has(event.id)}
                  registrationStatus={reg?.status as 'registered' | 'waitlisted' | 'checked_in' | 'cancelled' | null}
                  waitlistPosition={reg?.waitlist_position || null}
                  is_paid={event.is_paid}
                  price={event.price}
                  friendAttendance={friendAttendanceMap[event.id]}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* ── Past Events Archive Section ──────────────────────────────────────── */}
      {pastEvents.length > 0 && (
        <div className="space-y-6 border-t border-[--border-subtle] pt-10">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-[--text-primary]">
              Past Events Archive ({pastEvents.length})
            </h2>
            <p className="text-sm text-[--text-secondary]">
              Completed gatherings and activities organized by {organizer.full_name}.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-85">
            {pastEvents.map((event) => {
              const reg = userRegMap.get(event.id)
              return (
                <EventCard
                  key={event.id}
                  id={event.id}
                  title={event.title}
                  slug={event.slug}
                  category={event.category}
                  event_date={event.event_date}
                  start_time={event.start_time}
                  location={event.location}
                  capacity={event.capacity}
                  banner_url={event.banner_url}
                  campus={campus}
                  organizer={{
                    full_name: organizer.full_name,
                    avatar_url: organizer.avatar_url,
                    is_verified: organizer.is_verified,
                  }}
                  organizer_id={organizer.id}
                  registrations_count={
                    event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
                  }
                  isAuthenticated={!!user}
                  isFavorited={favorites.has(event.id)}
                  registrationStatus={reg?.status as 'registered' | 'waitlisted' | 'checked_in' | 'cancelled' | null}
                  waitlistPosition={reg?.waitlist_position || null}
                  is_paid={event.is_paid}
                  price={event.price}
                />
              )
            })}
          </div>
        </div>
      )}
    </SectionContainer>
  )
}
