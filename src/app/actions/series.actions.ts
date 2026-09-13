'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { generateOccurrences } from '@/lib/events/recurrence'
import { notificationService } from '@/lib/notifications/service'
import type { EventSeries, Event } from '@/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function getEventSeries(slug: string): Promise<{
  success: boolean
  series?: EventSeries
  error?: string
}> {
  const supabase = await createClient()

  const { data: series, error: seriesErr } = await supabase
    .from('event_series')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (seriesErr || !series) {
    return { success: false, error: 'Event series not found' }
  }

  // Fetch organizer details
  let organizer = null
  if (series.organizer_id) {
    const { data: orgData } = await supabase
      .from('organizer_profiles')
      .select('full_name, avatar_url, is_verified')
      .eq('id', series.organizer_id)
      .maybeSingle()
    if (orgData) {
      organizer = {
        id: series.organizer_id,
        display_name: orgData.full_name,
        avatar_url: orgData.avatar_url,
        is_verified: orgData.is_verified,
      }
    }
  }

  // Fetch campus details
  let campus = null
  if (series.campus_id) {
    const { data: campusData } = await supabase
      .from('campuses')
      .select('id, name, slug')
      .eq('id', series.campus_id)
      .maybeSingle()
    campus = campusData
  }

  // Fetch all occurrences in this series
  const { data: occurrences, error: occErr } = await supabase
    .from('events')
    .select('*')
    .eq('series_id', series.id)
    .order('event_date', { ascending: true })

  if (occErr) {
    return { success: false, error: 'Failed to load series occurrences' }
  }

  const typedOccurrences = (occurrences || []) as unknown as Event[]

  const result: EventSeries = {
    id: series.id,
    organizer_id: series.organizer_id,
    campus_id: series.campus_id,
    title: series.title,
    slug: series.slug,
    description: series.description,
    recurrence_type: series.recurrence_type as 'weekly' | 'monthly' | 'custom',
    interval_value: series.interval_value,
    days_of_week: series.days_of_week,
    end_type: series.end_type as 'date' | 'count',
    end_date: series.end_date,
    occurrence_count: series.occurrence_count,
    created_at: series.created_at,
    updated_at: series.updated_at,
    campus,
    organizer: organizer ?? undefined,
    occurrences: typedOccurrences,
  }

  return { success: true, series: result }
}

export interface CreateSeriesInput {
  title: string
  description?: string | null
  category: string
  location: string
  capacity?: number | null
  banner_url?: string | null
  is_paid?: boolean
  price?: number | null
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  recurrenceType: 'weekly' | 'monthly' | 'custom'
  intervalValue?: number
  daysOfWeek?: number[]
  endType: 'date' | 'count'
  endDate?: string | null
  occurrenceCount?: number | null
  registrationMode?: 'individual' | 'team' | 'both'
  minTeamSize?: number | null
  maxTeamSize?: number | null
  maxTeams?: number | null
}

export async function createEventSeries(input: CreateSeriesInput): Promise<{
  success: boolean
  seriesId?: string
  seriesSlug?: string
  occurrencesCount?: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified, campus_id, campus_verification_status')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'organizer' || !profile.is_verified) {
    return { success: false, error: 'Verified organizer role required' }
  }

  let baseSlug = slugify(input.title)
  if (!baseSlug) baseSlug = 'series'
  let seriesSlug = baseSlug
  let attempt = 0

  while (true) {
    const { data: existing } = await supabase
      .from('event_series')
      .select('id')
      .eq('slug', seriesSlug)
      .maybeSingle()

    if (!existing) break

    attempt++
    seriesSlug = `${baseSlug}-${attempt}`
    if (attempt > 20) {
      seriesSlug = `${baseSlug}-${Date.now()}`
      break
    }
  }

  // 1. Insert series row
  const { data: insertedSeries, error: seriesErr } = await supabase
    .from('event_series')
    .insert({
      organizer_id: user.id,
      campus_id: profile.campus_id,
      title: input.title,
      slug: seriesSlug,
      description: input.description || null,
      recurrence_type: input.recurrenceType,
      interval_value: input.intervalValue || 1,
      days_of_week: input.daysOfWeek || null,
      end_type: input.endType,
      end_date: input.endType === 'date' ? input.endDate : null,
      occurrence_count: input.endType === 'count' ? input.occurrenceCount : null,
    })
    .select('id')
    .single()

  if (seriesErr || !insertedSeries) {
    return { success: false, error: seriesErr?.message || 'Failed to create event series' }
  }

  // 2. Generate occurrences
  const occurrences = generateOccurrences({
    startDate: input.startDate,
    startTime: input.startTime,
    endTime: input.endTime,
    recurrenceType: input.recurrenceType,
    intervalValue: input.intervalValue,
    daysOfWeek: input.daysOfWeek,
    endType: input.endType,
    endDate: input.endDate || undefined,
    occurrenceCount: input.occurrenceCount || undefined,
    seriesTitle: input.title,
    seriesSlug,
  })

  if (occurrences.length === 0) {
    return { success: false, error: 'No occurrences generated with given recurrence schedule' }
  }

  // 3. Batch insert event occurrences
  const eventPayloads = occurrences.map((occ) => ({
    title: occ.title,
    slug: occ.slug,
    description: input.description || null,
    category: input.category,
    location: input.location,
    event_date: occ.eventDate,
    start_time: occ.startTime,
    end_time: occ.endTime,
    capacity: input.capacity || null,
    banner_url: input.banner_url || null,
    status: 'published' as const,
    is_paid: Boolean(input.is_paid),
    price: input.price || null,
    organizer_id: user.id,
    campus_id: profile.campus_id,
    series_id: insertedSeries.id,
    series_sequence_index: occ.sequenceIndex,
    is_series_override: false,
    registration_mode: input.registrationMode || 'individual',
    min_team_size: input.minTeamSize || 2,
    max_team_size: input.maxTeamSize || 4,
    max_teams: input.maxTeams || null,
  }))

  const { error: insertErr } = await supabase.from('events').insert(eventPayloads)

  if (insertErr) {
    console.error('Failed to create occurrences for series:', insertErr)
    return {
      success: true,
      seriesId: insertedSeries.id,
      seriesSlug,
      occurrencesCount: 0,
      error: 'Series created, but some occurrences could not be inserted.',
    }
  }

  revalidatePath('/series')
  revalidatePath('/dashboard/events')

  return {
    success: true,
    seriesId: insertedSeries.id,
    seriesSlug,
    occurrencesCount: occurrences.length,
  }
}

export async function cancelSeriesOccurrence(
  eventId: string,
  cancellationReason: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, series_id, title, slug')
    .eq('id', eventId)
    .single()

  if (!event) {
    return { success: false, error: 'Event occurrence not found' }
  }

  if (event.organizer_id !== user.id) {
    return { success: false, error: 'Unauthorized to cancel this occurrence' }
  }

  const { error: updateErr } = await supabase
    .from('events')
    .update({
      status: 'cancelled',
      cancellation_reason: cancellationReason,
      is_series_override: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId)

  if (updateErr) {
    return { success: false, error: updateErr.message }
  }

  // Notify registered attendees for this specific occurrence
  try {
    await notificationService.notifyAttendees({
      eventId: event.id,
      type: 'event_cancelled',
      title: `Event Cancelled: ${event.title}`,
      message: `This session has been cancelled. Reason: ${cancellationReason}`,
      link: `/events/${event.slug}`,
    })
  } catch (notifyErr) {
    console.error('Failed to notify attendees of session cancellation:', notifyErr)
  }

  if (event.series_id) {
    const { data: series } = await supabase
      .from('event_series')
      .select('slug')
      .eq('id', event.series_id)
      .single()
    if (series) {
      revalidatePath(`/series/${series.slug}`)
    }
  }

  revalidatePath(`/events/${event.slug}`)
  return { success: true }
}

export async function registerForEntireSeries(seriesId: string): Promise<{
  success: boolean
  registeredCount: number
  waitlistedCount: number
  alreadyRegisteredCount: number
  failedCount: number
  message?: string
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      registeredCount: 0,
      waitlistedCount: 0,
      alreadyRegisteredCount: 0,
      failedCount: 0,
      error: 'You must be logged in to register',
    }
  }

  const todayStr = new Date().toISOString().split('T')[0]

  // Fetch upcoming, non-cancelled sessions
  const { data: sessions, error: sessionErr } = await supabase
    .from('events')
    .select('id, title, slug, event_date, status')
    .eq('series_id', seriesId)
    .gte('event_date', todayStr)
    .neq('status', 'cancelled')
    .order('event_date', { ascending: true })

  if (sessionErr || !sessions || sessions.length === 0) {
    return {
      success: false,
      registeredCount: 0,
      waitlistedCount: 0,
      alreadyRegisteredCount: 0,
      failedCount: 0,
      error: 'No upcoming eligible sessions found in this series',
    }
  }

  let registeredCount = 0
  let waitlistedCount = 0
  let alreadyRegisteredCount = 0
  let failedCount = 0

  for (const session of sessions) {
    // Check existing registration
    const { data: existing } = await supabase
      .from('registrations')
      .select('status')
      .eq('event_id', session.id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing && (existing.status === 'registered' || existing.status === 'checked_in')) {
      alreadyRegisteredCount++
      continue
    }

    // Call atomic registration RPC
    const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_for_event', {
      p_event_id: session.id,
      p_allow_waitlist: true,
    })

    if (rpcErr || !rpcRes) {
      failedCount++
      continue
    }

    const res = rpcRes as { success?: boolean; status?: string }
    if (res.success) {
      if (res.status === 'registered') registeredCount++
      else if (res.status === 'waitlisted') waitlistedCount++
    } else {
      failedCount++
    }
  }

  return {
    success: true,
    registeredCount,
    waitlistedCount,
    alreadyRegisteredCount,
    failedCount,
    message: `Registered for ${registeredCount} sessions${waitlistedCount > 0 ? `, waitlisted for ${waitlistedCount}` : ''}${alreadyRegisteredCount > 0 ? `, already enrolled in ${alreadyRegisteredCount}` : ''}.`,
  }
}
