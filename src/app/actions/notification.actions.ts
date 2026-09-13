'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getUserNotificationPreferences } from '@/lib/notifications/preferences'
import type { UserNotificationPreferences, ActionResult, InAppNotification } from '@/types'

/**
 * Fetch current user's notification preferences.
 */
export async function getNotificationPreferences(): Promise<ActionResult<UserNotificationPreferences>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to view notification preferences.' }
  }

  try {
    const prefs = await getUserNotificationPreferences(user.id, supabase)
    return { success: true, data: prefs }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load preferences' }
  }
}

/**
 * Update user's notification preferences.
 */
export async function updateNotificationPreferences(
  input: Partial<Omit<UserNotificationPreferences, 'user_id' | 'updated_at'>>
): Promise<ActionResult<UserNotificationPreferences>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to update notification preferences.' }
  }

  const payload = {
    user_id: user.id,
    reminder_24h: input.reminder_24h !== undefined ? input.reminder_24h : true,
    reminder_1h: input.reminder_1h !== undefined ? input.reminder_1h : true,
    event_updates: input.event_updates !== undefined ? input.event_updates : true,
    waitlist_promotions: input.waitlist_promotions !== undefined ? input.waitlist_promotions : true,
    marketing_announcements: input.marketing_announcements !== undefined ? input.marketing_announcements : false,
    email_enabled: input.email_enabled !== undefined ? input.email_enabled : true,
    in_app_enabled: input.in_app_enabled !== undefined ? input.in_app_enabled : true,
    registration_confirmations_email: input.registration_confirmations_email !== undefined ? input.registration_confirmations_email : true,
    registration_confirmations_in_app: input.registration_confirmations_in_app !== undefined ? input.registration_confirmations_in_app : true,
    reminders_24h_in_app: input.reminders_24h_in_app !== undefined ? input.reminders_24h_in_app : true,
    reminders_1h_in_app: input.reminders_1h_in_app !== undefined ? input.reminders_1h_in_app : true,
    event_updates_in_app: input.event_updates_in_app !== undefined ? input.event_updates_in_app : true,
    waitlist_promotions_in_app: input.waitlist_promotions_in_app !== undefined ? input.waitlist_promotions_in_app : true,
    followed_clubs_email: input.followed_clubs_email !== undefined ? input.followed_clubs_email : true,
    followed_clubs_in_app: input.followed_clubs_in_app !== undefined ? input.followed_clubs_in_app : true,
    friend_activity_email: input.friend_activity_email !== undefined ? input.friend_activity_email : false,
    friend_activity_in_app: input.friend_activity_in_app !== undefined ? input.friend_activity_in_app : true,
    quiet_hours_enabled: input.quiet_hours_enabled !== undefined ? input.quiet_hours_enabled : false,
    quiet_hours_start: input.quiet_hours_start || '22:00',
    quiet_hours_end: input.quiet_hours_end || '08:00',
    delivery_timezone: input.delivery_timezone || 'UTC',
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update notification preferences:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/settings/notifications')
  revalidatePath('/settings')

  return { success: true, data: data as UserNotificationPreferences }
}

/**
 * Fetch notifications for current user with unread count.
 */
export async function getUserNotifications(
  limit = 20
): Promise<{ success: boolean; data: InAppNotification[]; unreadCount: number; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: true, data: [], unreadCount: 0 }
  }

  try {
    const [listRes, countRes] = await Promise.all([
      supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          event_id,
          type,
          title,
          message,
          link,
          is_read,
          email_status,
          email_recipient,
          email_provider,
          email_sent_at,
          email_error,
          dedup_key,
          created_at,
          event:events(id, title, slug, status)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false),
    ])

    if (listRes.error) {
      return { success: false, data: [], unreadCount: 0, error: listRes.error.message }
    }

    return {
      success: true,
      data: (listRes.data || []) as unknown as InAppNotification[],
      unreadCount: countRes.count || 0,
    }
  } catch (err) {
    return {
      success: false,
      data: [],
      unreadCount: 0,
      error: err instanceof Error ? err.message : 'Failed to fetch notifications',
    }
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(id: string): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * Mark all unread notifications for current user as read.
 */
export async function markAllNotificationsAsRead(): Promise<ActionResult<void>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
