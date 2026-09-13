import { Suspense } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { endOfWeek, endOfMonth, startOfToday, addDays } from 'date-fns'
import { Sparkles, Zap, Calendar, Flame, Compass, Info } from 'lucide-react'

import { APP_NAME } from '@/lib/constants'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventFilters } from '@/components/events/EventFilters'
import { EventGrid, EventGridSkeleton } from '@/components/events/EventGrid'
import { EventCard } from '@/components/events/EventCard'
import { createClient } from '@/lib/supabase/server'
import { measureDevPerf } from '@/lib/diagnostics/perf'
import { getBatchEventsFriendAttendance } from '@/lib/social/attendance'
import { explainRecommendation } from '@/lib/recommendations/ranking'
import type { Database } from '@/types/database.types'
import type { Campus, ConsentedFriendAttendance, RecommendationExplanation, EventCategory } from '@/types'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: `Browse Events — ${APP_NAME}`,
  description: 'Discover upcoming campus events — search, filter, and register instantly.',
}

type EventRow = Database['public']['Tables']['events']['Row'] & {
  registrations: { count: number }[]
  campus?: { id: string; name: string; slug: string } | null
}

interface EventsPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    date?: string
    sort?: string
    page?: string
    campus?: string
    cost?: string
    format?: string
    availability?: string
    organizer?: string
    view?: string
    from?: string
    to?: string
  }>
}

const DISCOVERY_LENSES = [
  { id: 'all', label: 'All Events', icon: Compass },
  { id: 'today', label: 'Happening Today', icon: Zap },
  { id: 'this-week', label: 'This Week', icon: Calendar },
  { id: 'popular', label: 'Popular', icon: Flame },
  { id: 'recommended', label: 'Recommended For You', icon: Sparkles },
]

async function EventResults({ searchParams }: { searchParams: EventsPageProps['searchParams'] }) {
  const params = await searchParams

  const q = params.q || ''
  const category = params.category || 'All'
  const dateStr = params.date || 'all'
  const sort = params.sort || 'soonest'
  const campusParam = params.campus
  const costParam = params.cost || 'all'
  const formatParam = params.format || 'all'
  const availabilityParam = params.availability || 'all'
  const organizerParam = params.organizer || 'all'
  const viewParam = params.view || 'all'
  const fromParam = params.from
  const toParam = params.to

  const page = parseInt(params.page || '1', 10)
  const pageSize = 12
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  // Get current user to determine authentication, campus, department, and registrations
  const { data: { user } } = await supabase.auth.getUser()

  let userCampusId: string | null = null
  let userDepartment: string | null = null
  let userCollege: string | null = null

  if (user) {
    const { data: profile } = await measureDevPerf('profile:role_lookup', () =>
      supabase
        .from('profiles')
        .select('campus_id, department, college')
        .eq('id', user.id)
        .maybeSingle()
    )
    if (profile) {
      userCampusId = profile.campus_id
      userDepartment = profile.department
      userCollege = profile.college
    }
  }

  // Build the primary query
  let query = supabase
    .from('events')
    .select(`
      *,
      registrations(count)
    `, { count: 'exact' })
    .eq('status', 'published')

  // Campus scoping
  let appliedCampusFilter = false
  if (campusParam === 'all') {
    // Intentionally cross-campus
  } else if (campusParam) {
    try {
      const { data: campusRow } = await measureDevPerf('campus:lookup', () =>
        supabase
          .from('campuses')
          .select('id')
          .eq('slug', campusParam)
          .maybeSingle()
      )
      if (campusRow) {
        query = query.eq('campus_id', campusRow.id)
        appliedCampusFilter = true
      } else {
        query = query.eq('campus_id', '00000000-0000-0000-0000-000000000000')
        appliedCampusFilter = true
      }
    } catch {
      // Graceful fallback if campuses not yet migrated
    }
  } else if (userCampusId) {
    query = query.eq('campus_id', userCampusId)
    appliedCampusFilter = true
  }

  // Search filter
  if (q) {
    query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`)
  }

  // Category filter
  if (category && category !== 'All') {
    query = query.ilike('category', category)
  }

  // Organizer filter
  if (organizerParam && organizerParam !== 'all') {
    query = query.eq('organizer_id', organizerParam)
  }

  // Cost filter (Free vs Paid)
  if (costParam === 'free') {
    query = query.or('is_paid.is.false,price.eq.0,price.is.null')
  } else if (costParam === 'paid') {
    query = query.eq('is_paid', true)
  }

  // Format filter (In-Person vs Online)
  if (formatParam === 'online') {
    query = query.or('location.ilike.%online%,location.ilike.%zoom%,location.ilike.%meet%,location.ilike.%virtual%,location.ilike.%webinar%')
  } else if (formatParam === 'in-person') {
    query = query
      .not('location', 'ilike', '%online%')
      .not('location', 'ilike', '%zoom%')
      .not('location', 'ilike', '%virtual%')
  }

  // Date and Discovery Lenses filtering
  const today = startOfToday()
  const todayStr = today.toISOString().split('T')[0]

  if (viewParam === 'today' || dateStr === 'today') {
    query = query.eq('event_date', todayStr)
  } else if (viewParam === 'this-week' || dateStr === 'week') {
    query = query
      .gte('event_date', todayStr)
      .lte('event_date', endOfWeek(today).toISOString().split('T')[0])
  } else if (dateStr === 'weekend') {
    // Find this weekend's dates
    const saturday = addDays(today, (6 - today.getDay() + 7) % 7)
    const sunday = addDays(saturday, 1)
    query = query
      .gte('event_date', saturday.toISOString().split('T')[0])
      .lte('event_date', sunday.toISOString().split('T')[0])
  } else if (dateStr === 'month') {
    query = query
      .gte('event_date', todayStr)
      .lte('event_date', endOfMonth(today).toISOString().split('T')[0])
  } else if (fromParam || toParam) {
    if (fromParam) query = query.gte('event_date', fromParam)
    if (toParam) query = query.lte('event_date', toParam)
  } else {
    // Default to upcoming events
    query = query.gte('event_date', todayStr)
  }

  // Sorting
  if (viewParam === 'today') {
    query = query.order('start_time', { ascending: true })
  } else if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'available') {
    query = query.order('capacity', { ascending: false, nullsFirst: true })
  } else {
    // Default: 'soonest', 'this-week', 'popular', 'recommended', 'all'
    query = query.order('event_date', { ascending: true }).order('start_time', { ascending: true })
  }

  // Pagination
  query = query.range(offset, offset + pageSize - 1)

  let { data: events, error, count } = await measureDevPerf('event:listing', () => query)

  // Fallback if campus_id is not yet migrated on the remote database
  if (error && appliedCampusFilter && (error.message?.includes('campus_id') || error.code === 'PGRST200' || error.details?.includes('campus_id'))) {
    let fallbackQuery = supabase
      .from('events')
      .select(`*, registrations(count)`, { count: 'exact' })
      .eq('status', 'published')

    if (q) fallbackQuery = fallbackQuery.or(`title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`)
    if (category && category !== 'All') fallbackQuery = fallbackQuery.ilike('category', category)
    if (costParam === 'free') fallbackQuery = fallbackQuery.or('is_paid.is.false,price.eq.0,price.is.null')
    else if (costParam === 'paid') fallbackQuery = fallbackQuery.eq('is_paid', true)

    if (viewParam === 'today' || dateStr === 'today') fallbackQuery = fallbackQuery.eq('event_date', todayStr)
    else if (viewParam === 'this-week' || dateStr === 'week') fallbackQuery = fallbackQuery.gte('event_date', todayStr).lte('event_date', endOfWeek(today).toISOString().split('T')[0])
    else fallbackQuery = fallbackQuery.gte('event_date', todayStr)

    fallbackQuery = fallbackQuery.order('event_date', { ascending: true }).order('start_time', { ascending: true })
    fallbackQuery = fallbackQuery.range(offset, offset + pageSize - 1)
    const fallbackRes = await measureDevPerf('event:listing', () => fallbackQuery)
    events = fallbackRes.data
    error = fallbackRes.error
    count = fallbackRes.count
  }

  if (error) {
    console.error('Error fetching events:', error.message)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-200">
        <h3 className="font-semibold">Error loading events</h3>
        <p className="mt-1 text-sm">{error.message}</p>
      </div>
    )
  }

  let typedEvents = (events || []) as unknown as EventRow[]

  // Fetch user favorites and user registrations in parallel
  const favorites = new Set<string>()
  const userRegMap = new Map<string, { status: 'registered' | 'waitlisted' | 'checked_in' | 'cancelled'; waitlist_position?: number | null }>()

  if (user && typedEvents.length > 0) {
    const eventIds = typedEvents.map((e) => e.id)
    const [favRes, regRes] = await Promise.all([
      supabase.from('favorites').select('event_id').eq('user_id', user.id).in('event_id', eventIds),
      supabase.from('registrations').select('event_id, status, waitlist_position').eq('user_id', user.id).in('event_id', eventIds),
    ])

    if (favRes.data) {
      favRes.data.forEach((f) => favorites.add(f.event_id))
    }
    if (regRes.data) {
      regRes.data.forEach((r) => {
        userRegMap.set(r.event_id, {
          status: r.status as 'registered' | 'waitlisted' | 'checked_in' | 'cancelled',
          waitlist_position: r.waitlist_position,
        })
      })
    }
  }

  // Fetch safe public organizer info
  const orgMap = new Map<string, { full_name: string; avatar_url: string | null; is_verified?: boolean }>()
  if (typedEvents.length > 0) {
    const orgIds = [...new Set(typedEvents.map((e) => e.organizer_id))]
    let loadedOrgs = false
    try {
      const { data: orgData, error: orgErr } = await supabase
        .from('organizer_profiles')
        .select('id, full_name, avatar_url, is_verified')
        .in('id', orgIds)
      if (!orgErr && orgData) {
        loadedOrgs = true
        orgData.forEach((o) => {
          if (o.id) {
            orgMap.set(o.id, {
              full_name: o.full_name || 'Campus Organizer',
              avatar_url: o.avatar_url,
              is_verified: o.is_verified || false,
            })
          }
        })
      }
    } catch {}

    if (!loadedOrgs) {
      try {
        const { data: pData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', orgIds)
        if (pData) {
          pData.forEach((p) => {
            if (p.id) {
              orgMap.set(p.id, {
                full_name: p.full_name || 'Campus Organizer',
                avatar_url: p.avatar_url,
                is_verified: false,
              })
            }
          })
        }
      } catch {}
    }
  }

  // Fetch safe public campus info
  const campusMap = new Map<string, { id: string; name: string; slug: string }>()
  if (typedEvents.length > 0) {
    const campusIds = [
      ...new Set(
        typedEvents
          .map((e: unknown) => (e as { campus_id?: string | null }).campus_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      ),
    ]
    if (campusIds.length > 0) {
      try {
        const { data: cData } = await supabase
          .from('campuses')
          .select('id, name, slug')
          .in('id', campusIds)
        if (cData) {
          cData.forEach((c) => campusMap.set(c.id, c))
        }
      } catch {}
    }
  }

  // Availability in-memory filter if requested
  if (availabilityParam === 'open') {
    typedEvents = typedEvents.filter((e) => {
      if (e.capacity === null) return true
      const active = e.active_registrations_count ?? (e.registrations?.[0]?.count || 0)
      return e.capacity > active
    })
  } else if (availabilityParam === 'waitlist') {
    typedEvents = typedEvents.filter((e) => {
      if (e.capacity === null) return false
      const active = e.active_registrations_count ?? (e.registrations?.[0]?.count || 0)
      return active >= e.capacity
    })
  }

  // Phase 12: Club Follows and Friend Attendance for visible events
  let followedClubIds = new Set<string>()
  let friendAttendanceMap: Record<string, ConsentedFriendAttendance> = {}
  const recExplanationMap = new Map<string, RecommendationExplanation>()

  if (user && typedEvents.length > 0) {
    const [followRowsRes, batchAttendance] = await Promise.all([
      supabase.from('club_follows').select('organizer_id').eq('user_id', user.id),
      getBatchEventsFriendAttendance(typedEvents.map((e) => e.id)),
    ])
    if (followRowsRes.data) {
      followedClubIds = new Set(followRowsRes.data.map((r) => r.organizer_id))
    }
    friendAttendanceMap = batchAttendance
  }

  // Compute recommendation explanations
  if (typedEvents.length > 0) {
    for (const evt of typedEvents) {
      const expl = explainRecommendation(
        {
          id: evt.id,
          organizer_id: evt.organizer_id,
          title: evt.title,
          slug: evt.slug,
          description: evt.description || '',
          location: evt.location,
          starts_at: `${evt.event_date}T${evt.start_time}`,
          ends_at: `${evt.event_date}T${evt.end_time || evt.start_time}`,
          cover_image: evt.banner_url,
          category: evt.category as EventCategory,
          capacity: evt.capacity,
          is_published: evt.status === 'published',
          tags: Array.isArray((evt as unknown as { tags?: string[] }).tags)
            ? ((evt as unknown as { tags?: string[] }).tags as string[])
            : [],
          campus_id: (evt as unknown as { campus_id?: string | null }).campus_id ?? null,
          created_at: evt.created_at,
          updated_at: evt.updated_at,
          active_registrations_count: evt.active_registrations_count ?? (evt.registrations?.[0]?.count || 0),
          organizer: orgMap.get(evt.organizer_id)
            ? {
                id: evt.organizer_id,
                display_name: orgMap.get(evt.organizer_id)!.full_name,
                avatar_url: orgMap.get(evt.organizer_id)!.avatar_url,
                is_verified: Boolean(orgMap.get(evt.organizer_id)!.is_verified),
              }
            : undefined,
        },
        {
          userCampusId,
          followedClubIds,
          friendAttendanceMap,
          userInterests: [userDepartment, userCollege].filter(Boolean) as string[],
        }
      )
      recExplanationMap.set(evt.id, expl)
    }
  }

  // Discovery Lens "Recommended for You" transparent scoring
  if (viewParam === 'recommended' && typedEvents.length > 0) {
    typedEvents.sort((a, b) => {
      const scoreA = recExplanationMap.get(a.id)?.score || 0
      const scoreB = recExplanationMap.get(b.id)?.score || 0
      if (scoreB !== scoreA) {
        return scoreB - scoreA
      }
      return a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time)
    })
  }

  // Discovery Lens "Popular" / sort === 'popular' ranking
  if ((viewParam === 'popular' || sort === 'popular') && typedEvents.length > 0) {
    typedEvents.sort((a, b) => {
      const aCount = a.active_registrations_count ?? (a.registrations?.[0]?.count || 0)
      const bCount = b.active_registrations_count ?? (b.registrations?.[0]?.count || 0)
      if (bCount !== aCount) {
        return bCount - aCount
      }
      return a.event_date.localeCompare(b.event_date) || a.start_time.localeCompare(b.start_time)
    })
  }

  // Contextual empty state text
  let emptyTitle = 'No events found'
  let emptyDescription = "We couldn't find any events matching your current filters. Try adjusting your search criteria or checking back later."
  let secondaryLabel = "Explore This Week's Events"
  let secondaryHref = '/events?view=this-week'

  if (viewParam === 'today') {
    emptyTitle = 'No events scheduled for today'
    emptyDescription = "There are no campus activities happening today. Check out what's coming up this week!"
    secondaryLabel = "View This Week's Schedule"
    secondaryHref = '/events?view=this-week'
  } else if (viewParam === 'this-week') {
    emptyTitle = 'No events scheduled for this week'
    emptyDescription = "No events were found between now and Sunday. Browse all upcoming events across campus."
    secondaryLabel = 'Browse All Events'
    secondaryHref = '/events?view=all'
  } else if (appliedCampusFilter && campusParam !== 'all') {
    emptyTitle = 'No events found for this campus'
    emptyDescription = "No events have been posted for your campus yet. Explore cross-campus events or check back soon."
    secondaryLabel = 'Explore All Campuses'
    secondaryHref = '/events?campus=all'
  }

  return (
    <div className="space-y-8">
      {/* Active Discovery Lens Explanatory Note */}
      {viewParam === 'today' && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 px-4 py-2.5 text-xs text-amber-900 dark:text-amber-300">
          <Info className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            <strong>Happening Today:</strong> Displaying all events scheduled for today, ordered chronologically by start time.
          </span>
        </div>
      )}
      {viewParam === 'this-week' && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-900/40 dark:bg-blue-950/20 px-4 py-2.5 text-xs text-blue-900 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 text-blue-600" />
          <span>
            <strong>This Week:</strong> Showing upcoming events scheduled between today and Sunday.
          </span>
        </div>
      )}
      {viewParam === 'popular' && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 dark:border-rose-900/40 dark:bg-rose-950/20 px-4 py-2.5 text-xs text-rose-900 dark:text-rose-300">
          <Info className="h-4 w-4 shrink-0 text-rose-600" />
          <span>
            <strong>Popular on Campus:</strong> Ranked transparently by student registrations, ticket velocity, and capacity demand.
          </span>
        </div>
      )}
      {viewParam === 'recommended' && (
        <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/60 dark:border-purple-900/40 dark:bg-purple-950/20 px-4 py-2.5 text-xs text-purple-900 dark:text-purple-300">
          <Info className="h-4 w-4 shrink-0 text-purple-600" />
          <span>
            <strong>Recommended for You:</strong> Transparently personalized based on your campus affiliation, department interests, and verified organizer credibility.
          </span>
        </div>
      )}

      <EventGrid
        isEmpty={!typedEvents || typedEvents.length === 0}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        secondaryLabel={secondaryLabel}
        secondaryHref={secondaryHref}
      >
        {typedEvents.map((event) => {
          const userReg = userRegMap.get(event.id)
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
              campus={(event as unknown as { campus_id?: string | null }).campus_id ? campusMap.get((event as unknown as { campus_id: string }).campus_id) || null : null}
              organizer={{
                full_name: orgMap.get(event.organizer_id)?.full_name || 'Campus Organizer',
                avatar_url: orgMap.get(event.organizer_id)?.avatar_url || null,
                is_verified: orgMap.get(event.organizer_id)?.is_verified || false,
              }}
              organizer_id={event.organizer_id}
              registrations_count={
                event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
              }
              isAuthenticated={!!user}
              isFavorited={favorites.has(event.id)}
              registrationStatus={userReg?.status || null}
              waitlistPosition={userReg?.waitlist_position || null}
              is_paid={event.is_paid}
              price={event.price}
              friendAttendance={friendAttendanceMap[event.id]}
              recommendationExplanation={viewParam === 'recommended' ? recExplanationMap.get(event.id) : null}
            />
          )
        })}
      </EventGrid>

      {/* Pagination */}
      {count && count > pageSize && (
        <div className="flex justify-center border-t border-[--border-subtle] pt-8 text-sm text-[--text-muted]">
          Showing {offset + 1}-{Math.min(offset + pageSize, count)} of {count} events
        </div>
      )}
    </div>
  )
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const supabase = await createClient()

  // Fetch active campuses for the filter
  const { data: campusesData } = await supabase
    .from('campuses')
    .select('id, name, slug, is_active, approved_domains')
    .eq('is_active', true)
    .order('name')
  const campuses = (campusesData || []) as Campus[]

  // Fetch active clubs/organizers for the organizer filter
  const { data: organizersData } = await supabase
    .from('organizer_profiles')
    .select('id, full_name')
    .order('full_name')
  const organizers = (organizersData || []) as Array<{ id: string; full_name: string }>

  // Fetch current user's campus if authenticated
  const { data: { user } } = await supabase.auth.getUser()
  let userCampusSlug: string | null = null
  let userCampusName: string | null = null

  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.campus_id) {
        const userCamp = campuses.find((c) => c.id === profile.campus_id)
        if (userCamp) {
          userCampusSlug = userCamp.slug
          userCampusName = userCamp.name
        }
      }
    } catch {}
  }

  const params = await searchParams
  const activeCampusSlug = params.campus || (userCampusSlug ?? 'all')
  const activeCampusName =
    activeCampusSlug === 'all'
      ? null
      : campuses.find((c) => c.slug === activeCampusSlug)?.name || userCampusName
  const currentView = params.view || 'all'

  return (
    <SectionContainer as="div" className="py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[--text-primary] sm:text-4xl">
            {activeCampusName ? `Events at ${activeCampusName}` : 'Discover Campus Events'}
          </h1>
          <p className="mt-1.5 text-sm text-[--text-secondary]">
            {activeCampusName
              ? `Explore upcoming activities, workshops, and gatherings around ${activeCampusName}.`
              : 'Find trusted student activities, workshops, and gatherings across campuses.'}
          </p>
        </div>
      </div>

      {/* Discovery Lenses Bar */}
      <div className="mb-8 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-[--border-subtle]">
        {DISCOVERY_LENSES.map((lens) => {
          const isActive = currentView === lens.id
          const newParams = new URLSearchParams()
          if (params.campus) newParams.set('campus', params.campus)
          if (params.category && params.category !== 'All') newParams.set('category', params.category)
          if (lens.id !== 'all') newParams.set('view', lens.id)
          const href = `/events${newParams.toString() ? `?${newParams.toString()}` : ''}`

          return (
            <Link
              key={lens.id}
              href={href}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition-all',
                isActive
                  ? 'bg-[--accent-600] text-white shadow-sm'
                  : 'bg-[--bg-surface] text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] border border-[--border-subtle]'
              )}
            >
              <lens.icon className="h-4 w-4" />
              <span>{lens.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Search and Filters */}
      <div className="space-y-8">
        <EventFilters
          campuses={campuses}
          userCampusSlug={userCampusSlug}
          organizers={organizers}
        />

        <Suspense fallback={<EventGridSkeleton count={8} />}>
          <EventResults searchParams={searchParams} />
        </Suspense>
      </div>
    </SectionContainer>
  )
}
