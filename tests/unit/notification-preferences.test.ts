import { describe, test, expect } from 'vitest'
import {
  shouldSendNotification,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '@/lib/notifications/preferences'
import type { UserNotificationPreferences } from '@/types'

describe('Phase 10: Notification Preferences & Delivery Policy', () => {
  const basePreferences: UserNotificationPreferences = {
    user_id: 'usr-1234',
    ...DEFAULT_NOTIFICATION_PREFERENCES,
  }

  test('default preferences enable in-app reminders and critical event updates', () => {
    expect(shouldSendNotification('reminder_24h', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('reminder_1h', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('event_rescheduled', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('venue_changed', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('event_cancelled', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('waitlist_promoted', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('registration_confirmed', basePreferences, 'in_app')).toBe(true)
    expect(shouldSendNotification('checked_in', basePreferences, 'in_app')).toBe(true)
  })

  test('students can opt out of 24h reminders while retaining 1h reminders', () => {
    const prefs: UserNotificationPreferences = {
      ...basePreferences,
      reminder_24h: false,
      reminder_1h: true,
    }

    expect(shouldSendNotification('reminder_24h', prefs, 'in_app')).toBe(false)
    expect(shouldSendNotification('reminder_1h', prefs, 'in_app')).toBe(true)
  })

  test('students can opt out of 1h reminders while retaining 24h reminders', () => {
    const prefs: UserNotificationPreferences = {
      ...basePreferences,
      reminder_24h: true,
      reminder_1h: false,
    }

    expect(shouldSendNotification('reminder_24h', prefs, 'in_app')).toBe(true)
    expect(shouldSendNotification('reminder_1h', prefs, 'in_app')).toBe(false)
  })

  test('disabling email_enabled blocks email channel while retaining in-app channel', () => {
    const prefs: UserNotificationPreferences = {
      ...basePreferences,
      email_enabled: false,
    }

    // Email channel blocked
    expect(shouldSendNotification('reminder_24h', prefs, 'email')).toBe(false)
    expect(shouldSendNotification('event_rescheduled', prefs, 'email')).toBe(false)
    expect(shouldSendNotification('announcement', prefs, 'email')).toBe(false)

    // In-app channel remains active
    expect(shouldSendNotification('reminder_24h', prefs, 'in_app')).toBe(true)
    expect(shouldSendNotification('event_rescheduled', prefs, 'in_app')).toBe(true)
  })

  test('transactional confirmations (registration_confirmed, checked_in) cannot be opted out in-app', () => {
    const strictOptOut: UserNotificationPreferences = {
      user_id: 'usr-999',
      reminder_24h: false,
      reminder_1h: false,
      event_updates: false,
      waitlist_promotions: false,
      marketing_announcements: false,
      email_enabled: false,
    }

    expect(shouldSendNotification('registration_confirmed', strictOptOut, 'in_app')).toBe(true)
    expect(shouldSendNotification('checked_in', strictOptOut, 'in_app')).toBe(true)
  })
})
