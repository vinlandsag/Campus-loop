'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { eventSchema, type EventFormData } from '@/lib/validations/event'
import { notificationService } from '@/lib/notifications/service'
import {
  getEventUserRole,
  canEditEvent,
  canCancelEvent,
  canDeleteEvent,
} from '@/lib/auth/teams'
import { createEventSeries } from '@/app/actions/series.actions'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createEvent(formData: EventFormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify organizer role and verification lifecycle
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified, campus_id, campus_verification_status')
    .eq('id', user.id)
    .maybeSingle()

  const isOrganizer = profile?.role === 'organizer' || user.user_metadata?.['role'] === 'organizer'
  if (!isOrganizer) {
    return { success: false, error: 'Only organizers can create events' }
  }

  if (!profile?.is_verified) {
    return {
      success: false,
      error: 'Your organizer account is pending approval. You cannot publish events until verified by campus administrators.',
    }
  }

  const campusStatus = profile?.campus_verification_status
  if (campusStatus !== 'verified' && campusStatus !== 'exception') {
    return {
      success: false,
      error: 'Your campus membership is unverified. Please verify your campus email before creating events.',
    }
  }

  // Server-side validation
  const validationResult = eventSchema.safeParse(formData)
  if (!validationResult.success) {
    return { success: false, error: 'Invalid form data' }
  }
  
  const data = validationResult.data

  // Phase 13: If recurring series requested, route to createEventSeries
  if (data.is_recurring) {
    const seriesRes = await createEventSeries({
      title: data.title,
      description: data.description,
      category: data.category,
      location: data.location,
      capacity: data.capacity,
      banner_url: data.banner_url,
      is_paid: data.is_paid,
      price: data.price,
      startDate: data.event_date,
      startTime: data.start_time,
      endTime: data.end_time,
      recurrenceType: data.recurrence_type || 'weekly',
      intervalValue: data.recurrence_interval || 1,
      daysOfWeek: data.recurrence_days,
      endType: data.recurrence_end_type || 'count',
      endDate: data.recurrence_end_date,
      occurrenceCount: data.recurrence_count || 6,
      registrationMode: data.registration_mode || 'individual',
      minTeamSize: data.min_team_size || 2,
      maxTeamSize: data.max_team_size || 4,
      maxTeams: data.max_teams || null,
    })

    if (!seriesRes.success) {
      return { success: false, error: seriesRes.error }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/events')
    revalidatePath('/events')
    redirect(`/series/${seriesRes.seriesSlug}`)
  }

  // Generate unique slug
  let baseSlug = slugify(data.title)
  if (!baseSlug) baseSlug = 'event'
  let slug = baseSlug
  let attempt = 0

  while (true) {
    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (!existing) break

    attempt++
    slug = `${baseSlug}-${attempt}`
    if (attempt > 20) {
      slug = `${baseSlug}-${Date.now()}`
      break
    }
  }

  const insertPayload: Record<string, unknown> = {
    title: data.title,
    description: data.description || null,
    category: data.category,
    event_date: data.event_date,
    start_time: data.start_time,
    end_time: data.end_time,
    location: data.location,
    capacity: data.capacity,
    banner_url: data.banner_url || null,
    status: data.status,
    is_paid: data.is_paid,
    price: data.price || null,
    slug,
    organizer_id: user.id,
    agenda: data.agenda || [],
    speakers: data.speakers || [],
    eligibility: data.eligibility || null,
    registration_deadline: data.registration_deadline || null,
    what_to_bring: data.what_to_bring || null,
    contact_method: data.contact_method || null,
    accessibility_notes: data.accessibility_notes || null,
    map_url: data.map_url || null,
    registration_mode: data.registration_mode || 'individual',
    min_team_size: data.min_team_size || 2,
    max_team_size: data.max_team_size || 4,
    max_teams: data.max_teams || null,
    // Phase 15: Structured Venues & Maps
    venue_id: data.venue_id || null,
    building: data.building || null,
    floor: data.floor || null,
    room: data.room || null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    accessibility_details: data.accessibility_details || data.accessibility_notes || null,
    directions_url: data.directions_url || data.map_url || null,
    reschedule_count: 0,
  }

  let { error } = await supabase.from('events').insert(insertPayload)

  // Defensive fallback if new Phase 7 columns are not yet present on remote DB
  if (error && (error.code === 'PGRST204' || error.message?.includes('column'))) {
    const basicPayload = {
      title: data.title,
      description: data.description || null,
      category: data.category,
      event_date: data.event_date,
      start_time: data.start_time,
      end_time: data.end_time,
      location: data.location,
      capacity: data.capacity,
      banner_url: data.banner_url || null,
      status: data.status,
      is_paid: data.is_paid,
      price: data.price || null,
      slug,
      organizer_id: user.id,
    }
    const fallbackRes = await supabase.from('events').insert(basicPayload)
    error = fallbackRes.error
  }

  if (error) {
    console.error('Create event error:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/events')
  revalidatePath('/events')
  redirect('/dashboard/events')
}

export async function updateEvent(eventId: string, formData: EventFormData, changeNotice?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Server-side validation
  const validationResult = eventSchema.safeParse(formData)
  if (!validationResult.success) {
    return { success: false, error: 'Invalid form data' }
  }
  
  const data = validationResult.data

  const role = await getEventUserRole(eventId, user.id)
  if (!canEditEvent(role)) {
    return { success: false, error: 'Only event owners and editors can update this event.' }
  }

  const { data: existingEvent } = await supabase
    .from('events')
    .select('id, organizer_id, slug, title, event_date, start_time, end_time, location, campus_id, reschedule_count')
    .eq('id', eventId)
    .maybeSingle()

  if (!existingEvent) {
    return { success: false, error: 'Event not found or access denied' }
  }

  // Check if there are active registrations
  const { count: activeRegCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .in('status', ['registered', 'checked_in'])

  const attendeeCount = activeRegCount ?? 0
  const hasAttendees = attendeeCount > 0

  const scheduleChanged =
    existingEvent.event_date !== data.event_date ||
    existingEvent.start_time !== data.start_time ||
    existingEvent.end_time !== data.end_time
  const locationChanged = existingEvent.location !== data.location

  const trimmedNotice = changeNotice?.trim() || ''

  // If there are registered attendees, changes to date/time or location REQUIRE a change notice
  if (hasAttendees && (scheduleChanged || locationChanged)) {
    if (trimmedNotice.length < 5) {
      return {
        success: false,
        error: 'A change notice explaining schedule or venue changes is required when attendees are registered (minimum 5 characters).',
      }
    }
  }

  const updatePayload: Record<string, unknown> = {
    title: data.title,
    description: data.description || null,
    category: data.category,
    event_date: data.event_date,
    start_time: data.start_time,
    end_time: data.end_time,
    location: data.location,
    capacity: data.capacity,
    banner_url: data.banner_url || null,
    status: data.status,
    is_paid: data.is_paid,
    price: data.price || null,
    agenda: data.agenda || [],
    speakers: data.speakers || [],
    eligibility: data.eligibility || null,
    registration_deadline: data.registration_deadline || null,
    what_to_bring: data.what_to_bring || null,
    contact_method: data.contact_method || null,
    accessibility_notes: data.accessibility_notes || null,
    map_url: data.map_url || null,
    registration_mode: data.registration_mode || 'individual',
    min_team_size: data.min_team_size || 2,
    max_team_size: data.max_team_size || 4,
    max_teams: data.max_teams || null,
    // Phase 15: Structured Venues & Maps
    venue_id: data.venue_id || null,
    building: data.building || null,
    floor: data.floor || null,
    room: data.room || null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    accessibility_details: data.accessibility_details || data.accessibility_notes || null,
    directions_url: data.directions_url || data.map_url || null,
  }

  const newRescheduleCount = (scheduleChanged || locationChanged)
    ? ((existingEvent.reschedule_count as number) || 0) + 1
    : ((existingEvent.reschedule_count as number) || 0)

  let { error } = await supabase
    .from('events')
    .update({
      ...updatePayload,
      reschedule_count: newRescheduleCount,
      ...(scheduleChanged ? { rescheduled_at: new Date().toISOString() } : {}),
      ...(trimmedNotice ? { change_notice: trimmedNotice } : {}),
    })
    .eq('id', eventId)
    .eq('organizer_id', user.id)

  if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
    const res = await supabase
      .from('events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('organizer_id', user.id)
    error = res.error
  }

  if (error) {
    console.error('Update event error:', error)
    return { success: false, error: error.message }
  }

  // Notify attendees if schedule or venue changed
  if (hasAttendees) {
    try {
      if (scheduleChanged) {
        await notificationService.notifyAttendees({
          eventId,
          type: 'event_rescheduled',
          title: `Event Rescheduled: ${data.title}`,
          message: `${trimmedNotice ? trimmedNotice + ' ' : ''}New Schedule: ${data.event_date}, ${data.start_time} - ${data.end_time}`,
          link: `/events/${existingEvent.slug}`,
        })
      } else if (locationChanged) {
        await notificationService.notifyAttendees({
          eventId,
          type: 'venue_changed',
          title: `Venue Changed: ${data.title}`,
          message: `${trimmedNotice ? trimmedNotice + ' ' : ''}New Location: ${data.location}`,
          link: `/events/${existingEvent.slug}`,
        })
      }
    } catch (notifyErr) {
      console.error('Failed to notify attendees of event changes:', notifyErr)
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/events')
  revalidatePath(`/events/${existingEvent.slug}`)
  revalidatePath('/events')
  revalidatePath('/my-events')
  redirect('/dashboard/events')
}

export async function cancelEvent(eventId: string, reason: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canCancelEvent(role)) {
    return { success: false, error: 'Only event owners can cancel this event.' }
  }

  const trimmedReason = reason?.trim()
  if (!trimmedReason || trimmedReason.length < 5) {
    return {
      success: false,
      error: 'Please provide a clear cancellation reason for registered attendees (minimum 5 characters).',
    }
  }

  const { data: existingEvent } = await supabase
    .from('events')
    .select('id, organizer_id, title, slug, status')
    .eq('id', eventId)
    .maybeSingle()

  if (!existingEvent) {
    return { success: false, error: 'Event not found or access denied' }
  }

  if (existingEvent.status === 'cancelled') {
    return { success: false, error: 'Event is already cancelled' }
  }

  let { error } = await supabase
    .from('events')
    .update({
      status: 'cancelled',
      cancellation_reason: trimmedReason,
    })
    .eq('id', eventId)

  if (error && (error.code === 'PGRST204' || error.message.includes('column'))) {
    const res = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', eventId)
    error = res.error
  }

  if (error) {
    console.error('Cancel event error:', error)
    return { success: false, error: error.message }
  }

  // Notify registered attendees
  try {
    await notificationService.notifyAttendees({
      eventId,
      type: 'event_cancelled',
      title: `Event Cancelled: ${existingEvent.title}`,
      message: `The event "${existingEvent.title}" has been cancelled. Reason: ${trimmedReason}`,
      link: `/events/${existingEvent.slug}`,
    })
  } catch (notifyErr) {
    console.error('Failed to dispatch cancellation notifications:', notifyErr)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/events')
  revalidatePath(`/events/${existingEvent.slug}`)
  revalidatePath('/events')
  revalidatePath('/my-events')

  return { success: true }
}

export async function deleteEvent(eventId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canDeleteEvent(role)) {
    return { success: false, error: 'Only event owners can delete this event.' }
  }

  // Check event exists and check registration count
  const { data: event } = await supabase
    .from('events')
    .select('id, organizer_id, status, title')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return { success: false, error: 'Event not found or access denied' }
  }

  // Deletion policy: Check registrations count
  const { count: regCount } = await supabase
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', eventId)

  if (regCount && regCount > 0) {
    return {
      success: false,
      error: `Cannot delete an event with registrations (found ${regCount} registered attendee${regCount > 1 ? 's' : ''}). Please Cancel the event with an explanation instead.`,
    }
  }

  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)

  if (error) {
    console.error('Delete event error:', error)
    return {
      success: false,
      error: error.message.includes('check_event_deletion_safety') || error.message.includes('registrations')
        ? 'Cannot delete an event that has registrations. Please cancel it instead.'
        : error.message,
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/events')
  revalidatePath('/events')
  revalidatePath('/my-events')

  return { success: true }
}
