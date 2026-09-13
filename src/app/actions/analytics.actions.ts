'use server'

import { createClient } from '@/lib/supabase/server'
import { isEventPast } from '@/lib/utils/date'
import type { EventMetricsData } from '@/types'

/**
 * Calculate comprehensive attendance and registration metrics for an event.
 */
export async function getEventMetrics(eventId: string): Promise<EventMetricsData> {
  const supabase = await createClient()

  // 1. Fetch event capacity and status
  const { data: event } = await supabase
    .from('events')
    .select('id, capacity, event_date, start_time, end_time, status')
    .eq('id', eventId)
    .single()

  const capacity = event?.capacity ?? null
  const isPast = event ? isEventPast(event) || event.status === 'completed' : false

  // 2. Fetch all registrations for this event
  const { data: registrations } = await supabase
    .from('registrations')
    .select('id, user_id, status, registered_at, checked_in_at')
    .eq('event_id', eventId)
    .order('registered_at', { ascending: true })

  const regs = registrations || []

  // Counts
  const registeredCount = regs.filter(
    (r) => r.status === 'registered' || r.status === 'checked_in'
  ).length

  const checkedInCount = regs.filter(
    (r) => r.status === 'checked_in' || Boolean(r.checked_in_at)
  ).length

  const waitlistCount = regs.filter((r) => r.status === 'waitlisted').length

  const attendanceRate =
    registeredCount > 0 ? Math.round((checkedInCount / registeredCount) * 100) : 0

  // No-shows: If event is in the past, active registrants who never checked in
  const noShowsCount = isPast ? Math.max(0, registeredCount - checkedInCount) : 0

  // Waitlist conversions: count notifications of type 'waitlist_promoted'
  const { count: conversionsCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('type', 'waitlist_promoted')

  const waitlistConversionsCount = conversionsCount || 0

  const capacityProgress =
    capacity && capacity > 0
      ? Math.min(100, Math.round((registeredCount / capacity) * 100))
      : 0

  // 3. Compute Registrations Over Time (timeline buckets)
  const dateMap = new Map<string, number>()

  for (const r of regs) {
    if (r.status === 'cancelled') continue
    const d = r.registered_at ? r.registered_at.split('T')[0] : 'Unknown'
    if (d) {
      dateMap.set(d, (dateMap.get(d) || 0) + 1)
    }
  }

  const sortedDates = Array.from(dateMap.keys()).sort()
  let cumulative = 0
  const registrationsOverTime = sortedDates.map((date) => {
    const count = dateMap.get(date) || 0
    cumulative += count
    return {
      date,
      count,
      cumulative,
    }
  })

  return {
    registrationsOverTime,
    attendanceRate,
    registeredCount,
    checkedInCount,
    noShowsCount,
    waitlistCount,
    waitlistConversionsCount,
    capacity,
    capacityProgress,
  }
}

/**
 * Fetch top-level organizer metrics across all owned and shared events.
 */
export async function getOrganizerOverviewMetrics(): Promise<{
  totalEvents: number
  totalRegistrations: number
  totalCheckedIn: number
  overallAttendanceRate: number
  totalWaitlisted: number
  totalWaitlistConversions: number
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      totalEvents: 0,
      totalRegistrations: 0,
      totalCheckedIn: 0,
      overallAttendanceRate: 0,
      totalWaitlisted: 0,
      totalWaitlistConversions: 0,
    }
  }

  // 1. Fetch events where user is organizer or team member
  const { data: ownedEvents } = await supabase
    .from('events')
    .select('id')
    .eq('organizer_id', user.id)

  const { data: teamEvents } = await supabase
    .from('event_team_members')
    .select('event_id')
    .eq('user_id', user.id)

  const eventIds = Array.from(
    new Set([
      ...(ownedEvents || []).map((e) => e.id),
      ...(teamEvents || []).map((t) => t.event_id),
    ])
  )

  if (eventIds.length === 0) {
    return {
      totalEvents: 0,
      totalRegistrations: 0,
      totalCheckedIn: 0,
      overallAttendanceRate: 0,
      totalWaitlisted: 0,
      totalWaitlistConversions: 0,
    }
  }

  // 2. Fetch registrations for these events
  const { data: regs } = await supabase
    .from('registrations')
    .select('status, checked_in_at')
    .in('event_id', eventIds)

  const registrations = regs || []
  const totalRegistrations = registrations.filter(
    (r) => r.status === 'registered' || r.status === 'checked_in'
  ).length

  const totalCheckedIn = registrations.filter(
    (r) => r.status === 'checked_in' || Boolean(r.checked_in_at)
  ).length

  const totalWaitlisted = registrations.filter((r) => r.status === 'waitlisted').length

  const overallAttendanceRate =
    totalRegistrations > 0 ? Math.round((totalCheckedIn / totalRegistrations) * 100) : 0

  // 3. Conversions count
  const { count: conversions } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .in('event_id', eventIds)
    .eq('type', 'waitlist_promoted')

  return {
    totalEvents: eventIds.length,
    totalRegistrations,
    totalCheckedIn,
    overallAttendanceRate,
    totalWaitlisted,
    totalWaitlistConversions: conversions || 0,
  }
}
