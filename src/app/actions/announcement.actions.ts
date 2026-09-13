'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canSendAnnouncements } from '@/lib/auth/teams'
import { notificationService } from '@/lib/notifications/service'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'
import type { AnnouncementTargetFilter, EventAnnouncement, AnnouncementCategory } from '@/types'

/**
 * Send an in-app announcement to attendees of an event.
 */
export async function sendEventAnnouncement(
  eventId: string,
  rawTitle: string,
  rawMessage: string,
  targetFilter: AnnouncementTargetFilter = 'all',
  isPinned: boolean = false,
  category: AnnouncementCategory = 'general'
): Promise<{ success: boolean; recipientCount?: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canSendAnnouncements(role)) {
    return { success: false, error: 'Only event owners and editors can broadcast announcements.' }
  }

  // Rate limit announcements: max 5 per event per hour
  const rateLimit = await checkDurableRateLimit(supabase, {
    key: `announcement:${eventId}`,
    action: 'broadcast_announcement',
    maxRequests: 5,
    windowSeconds: 3600,
  })

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'Rate limit exceeded: You can only send up to 5 announcements per hour for this event.',
    }
  }

  const title = rawTitle.trim()
  const message = rawMessage.trim()

  if (title.length < 3) {
    return { success: false, error: 'Announcement title must be at least 3 characters.' }
  }
  if (message.length < 5) {
    return { success: false, error: 'Announcement message must be at least 5 characters.' }
  }

  // 1. Fetch event metadata
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug')
    .eq('id', eventId)
    .single()

  if (eventErr || !event) {
    return { success: false, error: 'Event not found.' }
  }

  // 2. Query target registrations
  let regQuery = supabase
    .from('registrations')
    .select('user_id, status, checked_in_at')
    .eq('event_id', eventId)

  if (targetFilter === 'registered') {
    regQuery = regQuery.eq('status', 'registered')
  } else if (targetFilter === 'waitlisted') {
    regQuery = regQuery.eq('status', 'waitlisted')
  } else if (targetFilter === 'checked_in') {
    regQuery = regQuery.eq('status', 'checked_in')
  } else {
    // 'all' active or waitlisted
    regQuery = regQuery.neq('status', 'cancelled')
  }

  const { data: registrations, error: regErr } = await regQuery

  if (regErr) {
    console.error('Failed to fetch announcement recipients:', regErr)
    return { success: false, error: regErr.message }
  }

  const userIds = Array.from(new Set((registrations || []).map((r) => r.user_id)))

  if (userIds.length === 0) {
    return {
      success: false,
      error: `No attendees found matching filter "${targetFilter}".`,
    }
  }

  // 3. Batch dispatch in-app notifications
  try {
    const notifications = userIds.map((targetUserId) => ({
      userId: targetUserId,
      eventId,
      type: 'announcement' as const,
      title: `Announcement: ${title}`,
      message: `${message} — ${event.title}`,
      link: `/events/${event.slug}`,
    }))

    await notificationService.sendBatch(notifications)
  } catch (notifErr) {
    console.error('Failed to send announcement batch:', notifErr)
  }

  // 4. Record announcement in audit table
  try {
    await supabase.from('event_announcements').insert({
      event_id: eventId,
      sent_by: user.id,
      title,
      message,
      target_filter: targetFilter,
      recipient_count: userIds.length,
      is_pinned: Boolean(isPinned),
      category: category || 'general',
    } as unknown as Record<string, unknown>)
  } catch (auditErr) {
    console.warn('Audit record fallback warning:', auditErr)
  }

  // Phase 15: Dispatch Discord / Slack announcement webhooks
  try {
    const { dispatchAnnouncementWebhooks } = await import('@/lib/integrations/webhooks')
    await dispatchAnnouncementWebhooks({
      eventId,
      eventSlug: event.slug,
      eventTitle: event.title,
      category: category || 'general',
      message: `${title}\n\n${message}`,
      isPinned: isPinned || false,
    })
  } catch (whErr) {
    console.warn('Webhook dispatch error:', whErr)
  }

  revalidatePath(`/dashboard/events/${eventId}/announcements`)
  revalidatePath(`/events/${event.slug}`)
  revalidatePath(`/events/${event.slug}/live`)

  return { success: true, recipientCount: userIds.length }
}

/**
 * Fetch announcement history for an event.
 */
export async function getEventAnnouncements(
  eventId: string
): Promise<{ success: boolean; announcements: EventAnnouncement[]; error?: string }> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('event_announcements')
      .select('*')
      .eq('event_id', eventId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('getEventAnnouncements fallback warning:', error.message)
      return { success: true, announcements: [] }
    }

    const announcements: EventAnnouncement[] = (data || []).map((a) => ({
      id: a.id,
      event_id: a.event_id,
      sent_by: a.sent_by,
      title: a.title,
      message: a.message,
      target_filter: a.target_filter as AnnouncementTargetFilter,
      recipient_count: a.recipient_count,
      is_pinned: Boolean(a.is_pinned),
      category: (a.category as AnnouncementCategory) || 'general',
      created_at: a.created_at,
    }))

    return { success: true, announcements }
  } catch (err) {
    console.warn('getEventAnnouncements error:', err)
    return { success: true, announcements: [] }
  }
}
