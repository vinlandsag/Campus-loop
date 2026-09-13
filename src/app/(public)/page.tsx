import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarDays, Sparkles, Users, Search } from 'lucide-react'
import { APP_NAME, APP_DESCRIPTION } from '@/lib/constants'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { EventGrid } from '@/components/events/EventGrid'
import { EventCard } from '@/components/events/EventCard'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database.types'

type EventRow = Database['public']['Tables']['events']['Row'] & {
  registrations: { count: number }[]
  campus?: { id: string; name: string; slug: string } | null
}

export const metadata: Metadata = {
  title: `${APP_NAME} — Discover Campus Events`,
  description: APP_DESCRIPTION,
}

const FEATURES = [
  {
    icon: Search,
    title: 'Discover Events',
    description: 'Browse upcoming campus events filtered by category, date, and keyword.',
  },
  {
    icon: CalendarDays,
    title: 'Register Instantly',
    description: 'One-click registration with your campus account. No forms, no hassle.',
  },
  {
    icon: Sparkles,
    title: 'Favourite & Track',
    description: "Save events you're interested in and manage everything from your dashboard.",
  },
  {
    icon: Users,
    title: 'For Organizers',
    description: 'Create, publish, and manage events. View registrations and export data.',
  },
] as const

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userCampus: { id: string; name: string; slug: string } | null = null
  if (user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id')
        .eq('id', user.id)
        .maybeSingle()

      if (profile?.campus_id) {
        const { data: cData } = await supabase
          .from('campuses')
          .select('id, name, slug')
          .eq('id', profile.campus_id)
          .maybeSingle()
        if (cData) {
          userCampus = cData
        }
      }
    } catch {
      // Safe fallback if campus_id or campuses table is not ready
    }
  }

  let eventsQuery = supabase
    .from('events')
    .select(`
      *,
      registrations(count)
    `)
    .eq('status', 'published')
    .gte('event_date', new Date().toISOString().split('T')[0])
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(4)

  if (userCampus?.id) {
    eventsQuery = eventsQuery.eq('campus_id', userCampus.id)
  }

  let { data: events, error } = await eventsQuery

  // Fallback if campus_id is not yet in remote database
  if (error && userCampus?.id && (error.message?.includes('campus_id') || error.code === 'PGRST200')) {
    const fallbackRes = await supabase
      .from('events')
      .select(`
        *,
        registrations(count)
      `)
      .eq('status', 'published')
      .gte('event_date', new Date().toISOString().split('T')[0])
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(4)
    events = fallbackRes.data
    error = fallbackRes.error
  }

  if (error) {
    console.error('Error fetching homepage events:', error.message, error.details, error.hint, error.code)
  }

  // Also fetch user's favorites if authenticated to pass to EventCard
  const favorites = new Set<string>()
  if (user && events && events.length > 0) {
    const eventIds = events.map((e) => e.id)
    const { data: favData } = await supabase
      .from('favorites')
      .select('event_id')
      .eq('user_id', user.id)
      .in('event_id', eventIds)

    if (favData) {
      favData.forEach((f) => favorites.add(f.event_id))
    }
  }

  // Fetch safe public organizer info without exposing private profile fields
  const orgMap = new Map<string, { full_name: string; avatar_url: string | null; is_verified?: boolean }>()
  if (events && events.length > 0) {
    const orgIds = [...new Set(events.map((e) => e.organizer_id))]
    const { data: orgData } = await supabase
      .from('organizer_profiles')
      .select('id, full_name, avatar_url, is_verified')
      .in('id', orgIds)
    if (orgData) {
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
  }

  // Safe campus details map for event cards
  const campusMap = new Map<string, { id: string; name: string; slug: string }>()
  if (events && events.length > 0) {
    const campusIds = [
      ...new Set(
        events
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
      } catch {
        // Safe fallback
      }
    }
  }

  const typedEvents = events as unknown as EventRow[]

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[--border-subtle] bg-[--bg-surface]">
        {/* Subtle grid background */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(var(--text-primary) 1px, transparent 1px), linear-gradient(90deg, var(--text-primary) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          aria-hidden="true"
        />

        <div className="container-page relative py-20 md:py-28 lg:py-36">
          <div className="mx-auto max-w-3xl text-center">
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[--border-subtle] bg-[--bg-muted] px-3 py-1 text-xs font-medium text-[--text-muted]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[--accent-500]"
                aria-hidden="true"
              />
              Now live for your campus
            </div>

            <h1 className="text-balance font-display font-bold text-[--text-primary]">
              Your campus events,{' '}
              <span
                className="relative inline-block"
                style={{ color: 'var(--accent-600)' }}
              >
                all in one place
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-[--text-secondary] md:text-xl">
              {APP_DESCRIPTION}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/events"
                className="w-full rounded-lg bg-[--accent-500] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[--accent-600] sm:w-auto"
              >
                Browse Events
              </Link>
              {!user ? (
                <Link
                  href="/signup"
                  className="w-full rounded-lg border border-[--border-default] px-6 py-3 text-sm font-semibold text-[--text-secondary] transition-colors hover:border-[--border-strong] hover:text-[--text-primary] sm:w-auto"
                >
                  Create an Account
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="w-full rounded-lg border border-[--border-default] px-6 py-3 text-sm font-semibold text-[--text-secondary] transition-colors hover:border-[--border-strong] hover:text-[--text-primary] sm:w-auto"
                >
                  Go to Dashboard
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Events ──────────────────────────────────────────────── */}
      <SectionContainer as="section" className="border-b border-[--border-subtle]">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-[--text-primary]">
              {userCampus ? `Upcoming at ${userCampus.name}` : 'Upcoming Events'}
            </h2>
            <p className="mt-2 text-[--text-muted]">
              {userCampus
                ? `Curated events happening at ${userCampus.name}.`
                : "Don't miss out on what's happening around campus."}
            </p>
          </div>
          <Link
            href="/events"
            className="hidden text-sm font-medium text-[--text-primary] hover:underline sm:block"
          >
            View all events &rarr;
          </Link>
        </div>

        <EventGrid isEmpty={!typedEvents || typedEvents.length === 0}>
          {typedEvents?.map((event) => (
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
              campus={(event as unknown as { campus_id?: string }).campus_id ? campusMap.get((event as unknown as { campus_id?: string }).campus_id!) || null : null}
              organizer={{
                full_name: orgMap.get(event.organizer_id)?.full_name || 'Campus Organizer',
                avatar_url: orgMap.get(event.organizer_id)?.avatar_url || null,
                is_verified: orgMap.get(event.organizer_id)?.is_verified || false,
              }}
              registrations_count={
                event.active_registrations_count ?? (event.registrations?.[0]?.count || 0)
              }
              isAuthenticated={!!user}
              isFavorited={favorites.has(event.id)}
              is_paid={event.is_paid}
              price={event.price}
            />
          ))}
        </EventGrid>
        
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/events"
            className="inline-block text-sm font-medium text-[--text-primary] hover:underline"
          >
            View all events &rarr;
          </Link>
        </div>
      </SectionContainer>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <SectionContainer as="section" aria-labelledby="features-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="features-heading" className="text-balance font-display font-bold text-[--text-primary]">
            Everything you need to stay connected
          </h2>
          <p className="mt-3 text-[--text-muted]">
            CampusLoop makes it effortless to discover, attend, and organise the events that matter to your campus community.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 transition-shadow hover:shadow-[--shadow-sm]"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[--accent-100] text-[--accent-600]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-display text-base font-semibold text-[--text-primary]">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[--text-muted]">{description}</p>
            </div>
          ))}
        </div>
      </SectionContainer>

      {/* ── CTA Band ─────────────────────────────────────────────────────── */}
      <section className="border-t border-[--border-subtle] bg-[--bg-muted]">
        <div className="container-page py-12 text-center md:py-16">
          <h2 className="font-display text-2xl font-bold text-[--text-primary]">
            Ready to join your campus loop?
          </h2>
          <p className="mt-2 text-[--text-muted]">
            Sign up in seconds — it&apos;s free for students and organizers alike.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-block rounded-lg bg-[--accent-500] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[--accent-600]"
          >
            Get Started Free
          </Link>
        </div>
      </section>
    </>
  )
}
