'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventStartDateTime, getEventEndDateTime } from '@/lib/utils/date'
import type { EventFeedbackSummary, EventFeedback, ActionResult, FeedbackIssueCategory } from '@/types'

export interface SubmitFeedbackInput {
  eventId: string
  rating: number
  feedback?: string | null
  hasIssue?: boolean
  issueCategory?: FeedbackIssueCategory | null
  issueDescription?: string | null
}

/**
 * Submit or update an attendee's private event feedback.
 * Attendees can only review events they were confirmed or checked in for,
 * and only after the event has concluded (or after event start if already checked in).
 */
export async function submitEventFeedback(
  input: SubmitFeedbackInput
): Promise<ActionResult<EventFeedback>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to submit feedback.' }
  }

  if (input.rating < 1 || input.rating > 5) {
    return { success: false, error: 'Rating must be between 1 and 5 stars.' }
  }

  // 1. Verify user was registered or checked in for this event
  const { data: registration } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('event_id', input.eventId)
    .eq('user_id', user.id)
    .in('status', ['registered', 'checked_in'])
    .maybeSingle()

  if (!registration) {
    return {
      success: false,
      error: 'You can only leave feedback for events you were registered to attend.',
    }
  }

  // 2. Verify event timing eligibility:
  // Allowed only if event has concluded, OR if attendee is checked in and event has started.
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, event_date, start_time, end_time, timezone')
    .eq('id', input.eventId)
    .single()

  if (eventErr || !event) {
    return { success: false, error: 'Event not found.' }
  }

  const now = new Date()
  const startDateTime = getEventStartDateTime(event.event_date, event.start_time, event.timezone || 'UTC')
  const endDateTime = getEventEndDateTime(event.event_date, event.end_time, event.timezone || 'UTC')

  const isEnded = now >= endDateTime
  const isStartedAndCheckedIn = registration.status === 'checked_in' && now >= startDateTime

  if (!isEnded && !isStartedAndCheckedIn) {
    if (registration.status === 'checked_in') {
      return {
        success: false,
        error: 'Feedback can only be submitted once the event has started.',
      }
    }
    return {
      success: false,
      error: 'Feedback can only be submitted after the event has ended.',
    }
  }

  // 2. Upsert feedback
  const payload = {
    event_id: input.eventId,
    user_id: user.id,
    rating: Math.round(input.rating),
    feedback: input.feedback?.trim() || null,
    has_issue: Boolean(input.hasIssue),
    issue_category: input.hasIssue ? input.issueCategory || null : null,
    issue_description: input.hasIssue ? input.issueDescription?.trim() || null : null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('event_feedback')
    .upsert(payload, { onConflict: 'event_id,user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to submit event feedback:', error)
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/events/${input.eventId}/analytics`)
  revalidatePath('/my-events')

  return { success: true, data: data as EventFeedback }
}

/**
 * Fetch attendee's own feedback for an event.
 */
export async function getUserEventFeedback(
  eventId: string
): Promise<ActionResult<EventFeedback | null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('event_feedback')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return { success: false, error: error.message }
  }

  return { success: true, data: (data as EventFeedback) || null }
}

/**
 * Fetch aggregate event feedback summary for organizers.
 * Guaranteed privacy: Zero attendee IDs, names, or individual rating associations are exposed.
 */
export async function getEventFeedbackSummary(
  eventId: string
): Promise<ActionResult<EventFeedbackSummary>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to view feedback metrics.' }
  }

  const { data, error } = await supabase.rpc('get_event_feedback_aggregate', {
    p_event_id: eventId,
  })

  if (error) {
    console.error('Failed to fetch aggregate feedback:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as unknown as EventFeedbackSummary }
}
