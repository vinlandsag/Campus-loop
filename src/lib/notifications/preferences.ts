import { createClient } from '@/lib/supabase/server'
import type { UserNotificationPreferences, NotificationType } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export const DEFAULT_NOTIFICATION_PREFERENCES: Omit<UserNotificationPreferences, 'user_id' | 'updated_at'> = {
  reminder_24h: true,
  reminder_1h: true,
  event_updates: true,
  waitlist_promotions: true,
  marketing_announcements: false,
  email_enabled: true,
  in_app_enabled: true,
  registration_confirmations_email: true,
  registration_confirmations_in_app: true,
  reminders_24h_in_app: true,
  reminders_1h_in_app: true,
  event_updates_in_app: true,
  waitlist_promotions_in_app: true,
  followed_clubs_email: true,
  followed_clubs_in_app: true,
  friend_activity_email: false,
  friend_activity_in_app: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  delivery_timezone: 'UTC',
}

/**
 * Fetch or initialize notification preferences for a user.
 */
export async function getUserNotificationPreferences(
  userId: string,
  client?: SupabaseClient
): Promise<UserNotificationPreferences> {
  const supabase = client || (await createClient())

  const { data, error } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching notification preferences:', error)
  }

  if (data) {
    return data as UserNotificationPreferences
  }

  // Return default preferences if not yet explicitly saved
  return {
    user_id: userId,
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  }
}

/**
 * Determine if a notification of a given type should be sent based on user preferences.
 * Critical transactional notifications (registration confirmed, checked in, cancelled) always pass in-app.
 */
export function shouldSendNotification(
  type: NotificationType,
  prefs: UserNotificationPreferences,
  channel: 'in_app' | 'email' = 'in_app'
): boolean {
  if (channel === 'email' && !prefs.email_enabled) {
    return false
  }

  switch (type) {
    case 'reminder_24h':
      return prefs.reminder_24h
    case 'reminder_1h':
      return prefs.reminder_1h
    case 'reminder':
      return prefs.reminder_24h || prefs.reminder_1h
    case 'event_rescheduled':
    case 'venue_changed':
    case 'event_cancelled':
      // Essential event updates
      return prefs.event_updates
    case 'waitlist_promoted':
      return prefs.waitlist_promotions
    case 'announcement':
      return prefs.marketing_announcements
    case 'registration_confirmed':
    case 'checked_in':
      // Transactional safety confirmations cannot be opted out
      return true
    default:
      return true
  }
}
