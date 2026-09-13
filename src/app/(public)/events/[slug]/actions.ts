'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notificationService } from '@/lib/notifications/service'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'

export async function registerForEvent(
  eventId: string,
  slug: string,
  answers?: Record<string, string>
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to register.' }
  }

  // Durable rate limiting: max 10 registrations per 60 seconds per user
  const rateLimit = await checkDurableRateLimit(supabase, {
    key: user.id,
    action: 'event_registration',
    maxRequests: 10,
    windowSeconds: 60,
  })

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'Too many registration attempts. Please wait a moment before trying again.',
    }
  }

  // 1. Server-side pre-validation of questions if provided
  if (answers) {
    const { data: questions } = await supabase
      .from('event_registration_questions')
      .select('id, question_text, question_type, is_required')
      .eq('event_id', eventId)

    if (questions) {
      for (const q of questions) {
        if (q.is_required) {
          const val = answers[q.id]?.trim()
          if (!val) {
            return {
              success: false,
              error: `Please answer the required question: "${q.question_text}"`,
            }
          }
          if (q.question_type === 'checkbox' && val !== 'true') {
            return {
              success: false,
              error: `Required agreement not confirmed: "${q.question_text}"`,
            }
          }
        }
      }
    }
  }

  // 2. Execute canonical atomic registration RPC (fail closed — no insecure fallbacks)
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_answers: answers ?? null,
    p_allow_waitlist: true,
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  const result = rpcRes as {
    success?: boolean
    status?: 'registered' | 'waitlisted'
    registration_id?: string
    waitlist_position?: number | null
    ticket_code?: string | null
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Registration failed' }
  }

  // Phase 12: Set attendance visibility from user preferences (defaults to 'private')
  if (result.registration_id) {
    try {
      const { data: prefs } = await supabase
        .from('user_social_preferences')
        .select('default_attendance_visibility')
        .eq('user_id', user.id)
        .maybeSingle()

      if (prefs?.default_attendance_visibility) {
        await supabase
          .from('registrations')
          .update({ attendance_visibility: prefs.default_attendance_visibility })
          .eq('id', result.registration_id)
      }
    } catch {
      // Non-blocking fallback to schema default ('private')
    }
  }

  // 3. Dispatch in-app notification based on status
  try {
    const { data: eventData } = await supabase
      .from('events')
      .select('title')
      .eq('id', eventId)
      .single()

    const eventTitle = eventData?.title || 'the event'

    if (result.status === 'registered') {
      await notificationService.send({
        userId: user.id,
        eventId,
        type: 'registration_confirmed',
        title: 'Registration Confirmed',
        message: `You are registered for "${eventTitle}". Your digital admission ticket is ready!`,
        link: `/events/${slug}`,
      })
    } else if (result.status === 'waitlisted') {
      await notificationService.send({
        userId: user.id,
        eventId,
        type: 'registration_confirmed',
        title: 'Added to Waitlist',
        message: `You are #${result.waitlist_position || 1} on the waitlist for "${eventTitle}". We'll notify you automatically if a spot opens up!`,
        link: `/events/${slug}`,
      })
    }
  } catch (notifErr) {
    console.error('Failed to send registration notification:', notifErr)
  }

  revalidatePath(`/events/${slug}`)
  revalidatePath('/dashboard')
  revalidatePath('/my-events')
  revalidatePath('/events')
  revalidatePath('/')

  return {
    success: true,
    status: result.status,
    position: result.waitlist_position ?? null,
    registrationId: result.registration_id,
  }
}

/**
 * Promote the earliest waitlisted attendee (FIFO) when a spot becomes available.
 * Standalone promotion fails closed without uncoordinated direct table updates.
 */
export async function promoteWaitlistAttendee(
  eventId: string,
  _slug?: string,
  _eventTitle?: string
) {
  const supabase = await createClient()

  const { data: rpcResult, error: rpcErr } = await supabase.rpc(
    'promote_next_waitlisted_attendee',
    { p_event_id: eventId }
  )

  if (rpcErr) {
    console.error('promote_next_waitlisted_attendee error:', rpcErr)
    return { promoted: false, error: rpcErr.message }
  }

  const res = rpcResult as {
    success?: boolean
    promoted?: boolean
    registration_id?: string
    user_id?: string
    ticket_code?: string
    error?: string
  }

  if (res && res.success === false) {
    return { promoted: false, error: res.error || 'Event is at full capacity' }
  }

  return { promoted: Boolean(res?.promoted), attendeeId: res?.user_id }
}

export async function joinWaitlist(eventId: string, slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to join the waitlist.' }
  }

  // Canonical atomic registration RPC with waitlist permitted
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('register_for_event', {
    p_event_id: eventId,
    p_allow_waitlist: true,
  })

  if (rpcErr) {
    return { success: false, error: rpcErr.message }
  }

  const result = rpcRes as {
    success?: boolean
    status?: 'registered' | 'waitlisted'
    registration_id?: string
    waitlist_position?: number | null
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Could not join waitlist' }
  }

  // Dispatch notification if waitlisted
  if (result.status === 'waitlisted') {
    try {
      const { data: eventData } = await supabase
        .from('events')
        .select('title')
        .eq('id', eventId)
        .single()
      const eventTitle = eventData?.title || 'the event'
      await notificationService.send({
        userId: user.id,
        eventId,
        type: 'registration_confirmed',
        title: 'Added to Waitlist',
        message: `You are #${result.waitlist_position || 1} on the waitlist for "${eventTitle}". We'll notify you automatically if a spot opens up!`,
        link: `/events/${slug}`,
      })
    } catch (notifErr) {
      console.error('Failed to notify waitlisted user:', notifErr)
    }
  }

  revalidatePath(`/events/${slug}`)
  revalidatePath('/dashboard')
  revalidatePath('/my-events')
  revalidatePath('/events')

  return {
    success: true,
    status: result.status,
    position: result.waitlist_position ?? null,
  }
}

export async function leaveWaitlist(eventId: string, slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in.' }
  }

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_registration', {
    p_event_id: eventId,
  })

  if (rpcErr) {
    console.error('Leave Waitlist Error:', rpcErr)
    return { success: false, error: rpcErr.message }
  }

  const result = rpcRes as { success?: boolean; error?: string }
  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to leave waitlist' }
  }

  revalidatePath(`/events/${slug}`)
  revalidatePath('/my-events')
  return { success: true }
}

export async function unregisterFromEvent(eventId: string, slug: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to unregister.' }
  }

  // Canonical atomic cancellation RPC: cancels registration, promotes at most one waitlisted
  // attendee, issues their ticket, creates notification, and resequences waitlist in one transaction.
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('cancel_registration', {
    p_event_id: eventId,
  })

  if (rpcErr) {
    console.error('Unregister Error:', rpcErr)
    return { success: false, error: rpcErr.message }
  }

  const result = rpcRes as {
    success?: boolean
    promoted?: boolean
    promoted_user_id?: string | null
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to cancel registration' }
  }

  revalidatePath(`/events/${slug}`)
  revalidatePath('/dashboard')
  revalidatePath('/my-events')
  revalidatePath('/events')
  revalidatePath('/')

  return { success: true, promoted: result.promoted }
}

export async function toggleFavorite(eventId: string, slug: string, isFavorited: boolean) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to favorite events.' }
  }

  if (isFavorited) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .match({ event_id: eventId, user_id: user.id })

    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('favorites')
      .insert({ event_id: eventId, user_id: user.id })

    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/events/${slug}`)
  revalidatePath('/favorites')
  revalidatePath('/events')
  revalidatePath('/')

  return { success: true }
}
