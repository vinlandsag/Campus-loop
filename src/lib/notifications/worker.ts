import { createClient } from '@/lib/supabase/server'
import { dispatchNotificationJob } from './jobs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { NotificationWorkerRunResult } from '@/types'

export interface ProcessJobsOptions {
  limit?: number
  client?: SupabaseClient<Database>
}

/**
 * Process scheduled notification jobs safely and idempotently.
 *
 * Resilience features:
 * 1. Atomic job claiming to prevent race conditions across parallel worker invocations.
 * 2. Deduplication keys on in-app and email dispatches to prevent duplicate messages.
 * 3. Failure tracking with max retry attempts threshold.
 */
export async function processScheduledNotificationJobs(
  options?: ProcessJobsOptions
): Promise<NotificationWorkerRunResult> {
  const supabase = options?.client || (await createClient())
  const limit = options?.limit || 25

  const nowIso = new Date().toISOString()

  // 1. Query pending or retryable failed jobs scheduled on or before now
  const { data: eligibleJobs, error: queryErr } = await supabase
    .from('notification_jobs')
    .select('*')
    .or(`status.eq.pending,and(status.eq.failed,attempts.lt.max_attempts)`)
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(limit)

  if (queryErr) {
    console.error('Failed to query scheduled notification jobs:', queryErr)
    return {
      success: false,
      processedCount: 0,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [{ jobId: 'query', error: queryErr.message }],
    }
  }

  if (!eligibleJobs || eligibleJobs.length === 0) {
    return {
      success: true,
      processedCount: 0,
      completedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      errors: [],
    }
  }

  let completedCount = 0
  let failedCount = 0
  let skippedCount = 0
  const errors: Array<{ jobId: string; error: string }> = []

  for (const job of eligibleJobs) {
    // 2. Atomically claim the job by transitioning status to 'processing'
    const nextAttempts = (job.attempts || 0) + 1
    const { data: claimedJob, error: claimErr } = await supabase
      .from('notification_jobs')
      .update({
        status: 'processing',
        attempts: nextAttempts,
      })
      .eq('id', job.id)
      .eq('status', job.status) // Optimistic concurrency check
      .select('*')
      .maybeSingle()

    if (claimErr || !claimedJob) {
      // Another worker instance already claimed or altered this job
      skippedCount++
      continue
    }

    try {
      // 3. Fetch event details for title and context
      const { data: event, error: eventErr } = await supabase
        .from('events')
        .select('id, title, slug, event_date, start_time')
        .eq('id', claimedJob.event_id)
        .single()

      if (eventErr || !event) {
        throw new Error(`Event ${claimedJob.event_id} not found`)
      }

      // 4. Construct appropriate reminder message
      const is24h = claimedJob.job_type === 'reminder_24h'
      const title = is24h
        ? `Reminder: "${event.title}" is tomorrow!`
        : `Reminder: "${event.title}" starts in 1 hour!`
      const message = is24h
        ? `Your registered event "${event.title}" will take place tomorrow at ${event.start_time}. Make sure to bring your ticket!`
        : `Your registered event "${event.title}" starts in 1 hour at ${event.start_time}. Head to the venue soon!`

      // 5. Dispatch with deduplication & honesty tracking
      const result = await dispatchNotificationJob({
        eventId: claimedJob.event_id,
        jobType: claimedJob.job_type,
        title,
        message,
        link: `/events/${event.slug}`,
        client: supabase,
      })

      // 6. Mark job as successfully completed
      await supabase
        .from('notification_jobs')
        .update({
          status: 'completed',
          processed_at: new Date().toISOString(),
          recipients_count: result.recipientsCount,
          emails_sent_count: result.emailsSentCount,
          emails_skipped_count: result.emailsSkippedCount,
          error: null,
        })
        .eq('id', claimedJob.id)

      completedCount++
    } catch (jobErr) {
      const errMsg = jobErr instanceof Error ? jobErr.message : 'Unknown execution error'
      errors.push({ jobId: claimedJob.id, error: errMsg })
      failedCount++

      // If attempts exceeded max_attempts, permanently mark failed; otherwise leave eligible for retry
      const maxAttempts = claimedJob.max_attempts || 3
      const isFinalFailure = nextAttempts >= maxAttempts

      await supabase
        .from('notification_jobs')
        .update({
          status: isFinalFailure ? 'failed' : 'pending',
          error: errMsg,
          processed_at: new Date().toISOString(),
        })
        .eq('id', claimedJob.id)
    }
  }

  return {
    success: errors.length === 0,
    processedCount: completedCount + failedCount,
    completedCount,
    failedCount,
    skippedCount,
    errors,
  }
}
