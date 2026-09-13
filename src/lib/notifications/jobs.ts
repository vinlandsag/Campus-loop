import { createClient } from '@/lib/supabase/server'
import { emailService } from '@/lib/email/service'
import { getUserNotificationPreferences, shouldSendNotification } from './preferences'
import type { NotificationType, EmailDeliveryStatus } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'

export type JobType =
  | 'reminder_24h'
  | 'reminder_1h'
  | 'reschedule'
  | 'venue_change'
  | 'cancellation'
  | 'registration_confirmed'
  | 'waitlist_promoted'

export interface DispatchJobInput {
  eventId: string
  jobType: JobType
  title: string
  message: string
  link?: string | null
  client?: SupabaseClient
  targetUserId?: string // Optional: if targeting a single user (e.g. waitlist promotion or registration confirmation)
}

export interface JobExecutionResult {
  jobId?: string
  recipientsCount: number
  emailsSentCount: number
  emailsSkippedCount: number
  deduplicatedCount: number
}

/**
 * Dispatch an in-app and email-ready notification job with deduplication and honesty tracking.
 */
export async function dispatchNotificationJob(input: DispatchJobInput): Promise<JobExecutionResult> {
  const supabase = input.client || (await createClient())
  const { eventId, jobType, title, message, link, targetUserId } = input

  // 1. Fetch event metadata
  const { data: event } = await supabase
    .from('events')
    .select('id, title, slug, event_date, start_time, location')
    .eq('id', eventId)
    .single()

  if (!event) {
    throw new Error(`Event ${eventId} not found for notification job`)
  }

  // 2. Identify target recipients
  let targetUserIds: string[] = []

  if (targetUserId) {
    targetUserIds = [targetUserId]
  } else {
    // Broadcast to confirmed and checked-in attendees
    const { data: registrations } = await supabase
      .from('registrations')
      .select('user_id')
      .eq('event_id', eventId)
      .in('status', ['registered', 'checked_in'])

    if (!registrations || registrations.length === 0) {
      return { recipientsCount: 0, emailsSentCount: 0, emailsSkippedCount: 0, deduplicatedCount: 0 }
    }

    targetUserIds = Array.from(new Set(registrations.map((r) => r.user_id)))
  }

  let recipientsCount = 0
  let emailsSentCount = 0
  let emailsSkippedCount = 0
  let deduplicatedCount = 0

  const notificationType: NotificationType =
    jobType === 'reminder_24h'
      ? 'reminder_24h'
      : jobType === 'reminder_1h'
        ? 'reminder_1h'
        : jobType === 'cancellation'
          ? 'event_cancelled'
          : jobType === 'reschedule'
            ? 'event_rescheduled'
            : jobType === 'venue_change'
              ? 'venue_changed'
              : jobType === 'waitlist_promoted'
                ? 'waitlist_promoted'
                : 'registration_confirmed'

  // 3. Process each recipient with deduplication & preference checks
  for (const userId of targetUserIds) {
    const dedupKey = `${jobType}_${eventId}_${userId}`

    // Deduplication check: Has this notification already been generated for this user?
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('event_id', eventId)
      .eq('dedup_key', dedupKey)
      .maybeSingle()

    if (existing) {
      deduplicatedCount++
      continue
    }

    // Check user preferences
    const preferences = await getUserNotificationPreferences(userId, supabase)
    const shouldSendInApp = shouldSendNotification(notificationType, preferences, 'in_app')
    const shouldSendEmail = shouldSendNotification(notificationType, preferences, 'email')

    if (!shouldSendInApp && !shouldSendEmail) {
      continue
    }

    // Fetch user profile email
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle()

    const recipientEmail = profile?.email || null
    let emailStatus: EmailDeliveryStatus = 'skipped_no_provider'
    let emailError: string | null = null
    let emailSentAt: string | null = null
    let emailProviderName: string | null = null

    if (shouldSendEmail && recipientEmail) {
      if (!emailService.isConfigured()) {
        // Honesty: Credentials absent, do not pretend email was sent
        emailStatus = 'skipped_no_provider'
        emailsSkippedCount++
      } else {
        const sendResult = await emailService.send({
          to: recipientEmail,
          subject: `${title} - CampusLoop`,
          text: `${message}\n\nEvent: ${event.title}\nDate: ${event.event_date} at ${event.start_time}\nLocation: ${event.location}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">${title}</h2>
              <p>${message}</p>
              <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0 0 8px 0;"><strong>Event:</strong> ${event.title}</p>
                <p style="margin: 0 0 8px 0;"><strong>Date:</strong> ${event.event_date} at ${event.start_time}</p>
                <p style="margin: 0;"><strong>Location:</strong> ${event.location}</p>
              </div>
            </div>
          `,
        })

        emailStatus = sendResult.status
        emailProviderName = sendResult.provider
        if (sendResult.success) {
          emailsSentCount++
          emailSentAt = sendResult.sentAt || new Date().toISOString()
        } else {
          emailsSkippedCount++
          emailError = sendResult.error || null
        }
      }
    } else if (!shouldSendEmail) {
      emailStatus = 'opted_out'
    }

    // Insert in-app notification with email delivery audit
    if (shouldSendInApp) {
      const { error: insertErr } = await supabase.from('notifications').insert({
        user_id: userId,
        event_id: eventId,
        type: notificationType,
        title,
        message,
        link: link || `/events/${event.slug}`,
        is_read: false,
        email_status: emailStatus,
        email_recipient: recipientEmail,
        email_provider: emailProviderName,
        email_sent_at: emailSentAt,
        email_error: emailError,
        dedup_key: dedupKey,
      })

      if (!insertErr) {
        recipientsCount++
      } else {
        console.error('Failed to insert in-app notification:', insertErr)
      }
    }
  }

  return {
    recipientsCount,
    emailsSentCount,
    emailsSkippedCount,
    deduplicatedCount,
  }
}

/**
 * Schedule automated 24-hour and 1-hour reminder jobs for an event.
 */
export async function scheduleEventReminderJobs(
  eventId: string,
  eventDate: string,
  startTime: string,
  client?: SupabaseClient
): Promise<void> {
  const supabase = client || (await createClient())

  try {
    const eventStart = new Date(`${eventDate}T${startTime}:00Z`)
    if (isNaN(eventStart.getTime())) return

    const now = new Date()
    const scheduled24h = new Date(eventStart.getTime() - 24 * 60 * 60 * 1000)
    const scheduled1h = new Date(eventStart.getTime() - 60 * 60 * 1000)

    // Schedule 24h reminder if in the future
    if (scheduled24h > now) {
      await supabase.from('notification_jobs').insert({
        event_id: eventId,
        job_type: 'reminder_24h',
        scheduled_for: scheduled24h.toISOString(),
        status: 'pending',
      })
    }

    // Schedule 1h reminder if in the future
    if (scheduled1h > now) {
      await supabase.from('notification_jobs').insert({
        event_id: eventId,
        job_type: 'reminder_1h',
        scheduled_for: scheduled1h.toISOString(),
        status: 'pending',
      })
    }
  } catch (err) {
    console.error('Failed to schedule reminder jobs for event:', eventId, err)
  }
}
