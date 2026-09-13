import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { startOfToday } from 'date-fns'
import {
  Users,
  Building2,
  Bell,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventCard } from '@/components/events/EventCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ClubFollowButton } from '@/components/social/ClubFollowButton'
import { getBatchEventsFriendAttendance } from '@/lib/social/attendance'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { Database } from '@/types/database.types'
import type { ConsentedFriendAttendance } from '@/types'

export const metadata: Metadata = {
  title: `Following Feed — ${APP_NAME}`,
  description: 'Keep up with updates from clubs you follow and activities with your campus friends.',
}

type EventRow = Database['public']['Tables']['events']['Row'] & {
  registrations: { count: number }[]
  campus?: { id: string; name: string; slug: string } | null
}

interface FollowingPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function FollowingPage({ searchParams }: FollowingPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/following')
  }

  const resolvedParams = await searchParams
  const activeTab = resolvedParams.tab || 'clubs'

  const todayStr = startOfToday().toISOString().split('T')[0] || ''

  // 1. Fetch Followed Clubs
  const { data: followRows } = await supabase
    .from('club_follows')
    .select('id, organizer_id, notify_on_new_events, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const followedOrgIds = (followRows || []).map((f) => f.organizer_id)

  // Profiles of followed clubs
  const { data: orgProfiles } = followedOrgIds.length > 0
    ? await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_verified, bio, college, department')
        .in('id', followedOrgIds)
    : { data: [] }

  type OrgProfileSummary = {
    id: string
    full_name: string
    avatar_url: string | null
    is_verified: boolean
    bio?: string | null
    college?: string | null
    department?: string | null
  }

  const orgProfileMap = new Map<string, OrgProfileSummary>()
  if (orgProfiles) {
    for (const p of orgProfiles) {
      orgProfileMap.set(p.id, p)
    }
  }

  // 2. Fetch Mutual Friends who Opted In to Share Attendance
  const { data: friendships } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .eq('status', 'accepted')

  const mutualFriendUids = (friendships || []).map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  )

  let friendEventIds: string[] = []
  if (mutualFriendUids.length > 0) {
    // Check which mutual friends have share_attendance_with_friends = true
    const { data: optedInPrefs } = await supabase
      .from('user_social_preferences')
      .select('user_id')
      .in('user_id', mutualFriendUids)
      .eq('share_attendance_with_friends', true)

    const optedInUids = (optedInPrefs || []).map((p) => p.user_id)

    if (optedInUids.length > 0) {
      const { data: friendRegs } = await supabase
        .from('registrations')
        .select('event_id')
        .in('user_id', optedInUids)
        .in('attendance_visibility', ['friends', 'public'])
        .in('status', ['registered', 'checked_in'])

      friendEventIds = Array.from(
        new Set((friendRegs || []).map((r) => r.event_id))
      )
    }
  }

  // 3. Tab Specific Data Query
  let displayEvents: EventRow[] = []
  let friendAttendanceMap: Record<string, ConsentedFriendAttendance> = {}

  if (activeTab === 'clubs') {
    if (followedOrgIds.length > 0) {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*, registrations(count), campus:campuses(id, name, slug)')
        .in('organizer_id', followedOrgIds)
        .eq('status', 'published')
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })

      displayEvents = (eventsData || []) as unknown as EventRow[]
    }
  } else if (activeTab === 'friends') {
    if (friendEventIds.length > 0) {
      const { data: eventsData } = await supabase
        .from('events')
        .select('*, registrations(count), campus:campuses(id, name, slug)')
        .in('id', friendEventIds)
        .eq('status', 'published')
        .gte('event_date', todayStr)
        .order('event_date', { ascending: true })

      displayEvents = (eventsData || []) as unknown as EventRow[]
    }
  }

  // Batch query friend attendance for visible events
  if (displayEvents.length > 0) {
    friendAttendanceMap = await getBatchEventsFriendAttendance(
      displayEvents.map((e) => e.id)
    )
  }

  // Fetch favorites & registrations for user
  const favorites = new Set<string>()
  const userRegMap = new Map<
    string,
    { status: 'registered' | 'waitlisted' | 'checked_in' | 'cancelled'; waitlist_position?: number | null }
  >()
  if (displayEvents.length > 0) {
    const eids = displayEvents.map((e) => e.id)
    const [favs, regs] = await Promise.all([
      supabase.from('favorites').select('event_id').eq('user_id', user.id).in('event_id', eids),
      supabase.from('registrations').select('event_id, status, waitlist_position').eq('user_id', user.id).in('event_id', eids),
    ])
    if (favs.data) favs.data.forEach((f) => favorites.add(f.event_id))
    if (regs.data) {
      regs.data.forEach((r) =>
        userRegMap.set(r.event_id, {
          status: r.status as 'registered' | 'waitlisted' | 'checked_in' | 'cancelled',
          waitlist_position: r.waitlist_position,
        })
      )
    }
  }

  return (
    <SectionContainer as="div" className="py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-6">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[--text-primary]">
            Following & Social Feed
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Events from student clubs you follow and activities your friends are attending.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/friends"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Users className="h-4 w-4 text-[--accent-500]" />
            <span>Manage Friends ({mutualFriendUids.length})</span>
          </Link>
          <Link
            href="/events?view=recommended"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[--accent-500] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[--accent-600] transition-colors shadow-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>For You Feed</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-px">
        <Link
          href="/following?tab=clubs"
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'clubs'
              ? 'border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          )}
        >
          <Building2 className="h-4 w-4" />
          <span>Followed Clubs ({followedOrgIds.length})</span>
        </Link>

        <Link
          href="/following?tab=friends"
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'friends'
              ? 'border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          )}
        >
          <Users className="h-4 w-4" />
          <span>Friends&apos; Activity</span>
        </Link>

        <Link
          href="/following?tab=manage"
          className={cn(
            'flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'manage'
              ? 'border-amber-600 text-amber-600 dark:border-amber-500 dark:text-amber-400'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          )}
        >
          <Bell className="h-4 w-4" />
          <span>Manage Followed Clubs</span>
        </Link>
      </div>

      {/* Privacy Notice Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-950/60 dark:bg-indigo-950/20 p-4 text-xs text-indigo-900 dark:text-indigo-200">
        <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="font-semibold">Privacy First:</strong> CampusLoop protects your attendance.
          Friends&apos; activity only shows consented mutual friends who opted in to share their attendance.
          Your own RSVPs remain private unless you explicitly enable sharing in{' '}
          <Link href="/settings" className="underline font-semibold hover:text-indigo-700 dark:hover:text-indigo-100">
            Settings
          </Link>.
        </div>
      </div>

      {/* ── TAB 1: Followed Clubs Feed ────────────────────────────────────── */}
      {activeTab === 'clubs' && (
        <div className="space-y-6">
          {followedOrgIds.length === 0 ? (
            <EmptyState
              title="You are not following any campus clubs yet"
              description="Follow student organizations and campus societies to get their upcoming events and announcements delivered directly to this feed."
              actionLabel="Discover Verified Campus Clubs"
              actionHref="/events"
            />
          ) : displayEvents.length === 0 ? (
            <EmptyState
              title="No upcoming events from your followed clubs"
              description="The clubs you follow don't have any scheduled upcoming events right now. Check back soon or explore trending campus events."
              actionLabel="Browse All Events"
              actionHref="/events"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayEvents.map((event) => {
                const reg = userRegMap.get(event.id)
                const org = orgProfileMap.get(event.organizer_id)
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
                    campus={event.campus}
                    organizer={{
                      full_name: org?.full_name || 'Campus Club',
                      avatar_url: org?.avatar_url || null,
                      is_verified: org?.is_verified ?? true,
                    }}
                    organizer_id={event.organizer_id}
                    registrations_count={
                      event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
                    }
                    isAuthenticated={true}
                    isFavorited={favorites.has(event.id)}
                    registrationStatus={reg?.status || null}
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
      )}

      {/* ── TAB 2: Friends' Activity Feed ─────────────────────────────────── */}
      {activeTab === 'friends' && (
        <div className="space-y-6">
          {mutualFriendUids.length === 0 ? (
            <EmptyState
              title="You haven't connected with friends yet"
              description="Add friends by their campus email to discover events they're excited about (when they choose to share)."
              actionLabel="Find Campus Friends"
              actionHref="/friends"
            />
          ) : displayEvents.length === 0 ? (
            <EmptyState
              title="No friend activity right now"
              description="None of your mutual friends have opted in to share upcoming event attendance, or they haven't registered for upcoming events yet."
              actionLabel="Invite Friends & Connect"
              actionHref="/friends"
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {displayEvents.map((event) => {
                const reg = userRegMap.get(event.id)
                const org = orgProfileMap.get(event.organizer_id)
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
                    campus={event.campus}
                    organizer={{
                      full_name: org?.full_name || 'Campus Organizer',
                      avatar_url: org?.avatar_url || null,
                      is_verified: org?.is_verified ?? false,
                    }}
                    organizer_id={event.organizer_id}
                    registrations_count={
                      event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
                    }
                    isAuthenticated={true}
                    isFavorited={favorites.has(event.id)}
                    registrationStatus={reg?.status || null}
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
      )}

      {/* ── TAB 3: Manage Followed Clubs ─────────────────────────────────── */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {followedOrgIds.length === 0 ? (
            <EmptyState
              title="No clubs followed yet"
              description="When you follow verified student clubs, you can manage notification preferences and quick unfollows right here."
              actionLabel="Explore Campus Clubs"
              actionHref="/events"
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {followedOrgIds.map((orgId) => {
                const org = orgProfileMap.get(orgId)
                const followRow = followRows?.find((f) => f.organizer_id === orgId)
                return (
                  <div
                    key={orgId}
                    className="flex flex-col justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm transition-all hover:border-[--border-default]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <Link
                          href={`/organizers/${orgId}`}
                          className="font-display font-bold text-base text-[--text-primary] hover:text-[--accent-600] hover:underline"
                        >
                          {org?.full_name || 'Verified Campus Club'}
                        </Link>
                      </div>
                      {org?.bio && (
                        <p className="mt-1 text-xs text-[--text-secondary] line-clamp-2">
                          {org.bio}
                        </p>
                      )}
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t border-[--border-subtle] pt-3">
                      <Link
                        href={`/organizers/${orgId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[--accent-600] dark:text-[--accent-400] hover:underline"
                      >
                        <span>Club Profile</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>

                      <ClubFollowButton
                        organizerId={orgId}
                        initialIsFollowing={true}
                        initialNotify={followRow?.notify_on_new_events ?? true}
                        showFollowerCount={false}
                        isVerified={org?.is_verified ?? true}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </SectionContainer>
  )
}
