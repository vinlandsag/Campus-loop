'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'
import type {
  ModerationReport,
  ModerationTargetType,
  ModerationReportReason,
  ModerationReportStatus,
  ActionResult,
} from '@/types'

export interface SubmitModerationReportInput {
  targetType: ModerationTargetType
  targetId: string
  reason: ModerationReportReason
  details?: string | null
}

export interface UpdateReportStatusInput {
  reportId: string
  status: ModerationReportStatus
  adminNotes?: string | null
}

const MAX_REPORTS_PER_DAY = 5

/**
 * Submit a moderation report with abuse rate limits.
 */
export async function submitModerationReport(
  input: SubmitModerationReportInput
): Promise<ActionResult<ModerationReport>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to report an event or organizer.' }
  }

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // 1. Abuse Rate Limit 1: Durable max 5 reports per user per 24 hours
  const rateLimit = await checkDurableRateLimit(supabase, {
    key: user.id,
    action: 'submit_moderation_report',
    maxRequests: MAX_REPORTS_PER_DAY,
    windowSeconds: 24 * 60 * 60,
  })

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'You have reached the limit of 5 reports per 24 hours. Please wait before submitting additional reports.',
    }
  }

  const { count: dailyCount, error: countErr } = await supabase
    .from('moderation_reports')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_id', user.id)
    .gte('created_at', oneDayAgo)

  if (countErr) {
    console.error('Error checking report rate limit:', countErr)
  }

  if (dailyCount !== null && dailyCount >= MAX_REPORTS_PER_DAY) {
    return {
      success: false,
      error: 'You have reached the limit of 5 reports per 24 hours. Please wait before submitting additional reports.',
    }
  }

  // 2. Abuse Rate Limit 2: Deduplication - 1 report per target per 24 hours
  const { data: duplicate } = await supabase
    .from('moderation_reports')
    .select('id')
    .eq('reporter_id', user.id)
    .eq('target_type', input.targetType)
    .eq('target_id', input.targetId)
    .gte('created_at', oneDayAgo)
    .maybeSingle()

  if (duplicate) {
    return {
      success: false,
      error: `You have already submitted a report for this ${input.targetType} within the last 24 hours. Our moderation team is actively reviewing it.`,
    }
  }

  // 3. Insert report
  const payload = {
    reporter_id: user.id,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    details: input.details?.trim() || null,
    status: 'pending' as const,
  }

  const { data, error } = await supabase
    .from('moderation_reports')
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to submit moderation report:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: data as ModerationReport }
}

/**
 * Fetch moderation reports for administrators.
 */
export async function getModerationReports(options?: {
  status?: ModerationReportStatus
  limit?: number
}): Promise<ActionResult<ModerationReport[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can access the moderation review queue.' }
  }

  let query = supabase
    .from('moderation_reports')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch moderation reports:', error)
    return { success: false, error: error.message }
  }

  return { success: true, data: (data || []) as ModerationReport[] }
}

/**
 * Update moderation report status and admin notes.
 */
export async function updateModerationReportStatus(
  input: UpdateReportStatusInput
): Promise<ActionResult<ModerationReport>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can update moderation reports.' }
  }

  const payload: Record<string, unknown> = {
    status: input.status,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
  }

  if (input.adminNotes !== undefined) {
    payload['admin_notes'] = input.adminNotes?.trim() || null
  }

  const { data, error } = await supabase
    .from('moderation_reports')
    .update(payload)
    .eq('id', input.reportId)
    .select('*')
    .single()

  if (error) {
    console.error('Failed to update moderation report:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/moderation')

  return { success: true, data: data as ModerationReport }
}

export interface PendingOrganizer {
  id: string
  email: string
  full_name: string
  avatar_url?: string | null
  role: string
  is_verified: boolean
  campus_id?: string | null
  campus_name?: string | null
  campus_verification_status?: string | null
  college?: string | null
  department?: string | null
  bio?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  created_at: string
}

/**
 * Fetch pending organizer requests for administrators.
 */
export async function getPendingOrganizers(): Promise<ActionResult<PendingOrganizer[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can access the organizer verification queue.' }
  }

  const { data: organizers, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, is_verified, campus_id, campus_verification_status, college, department, bio, website_url, instagram_handle, created_at')
    .eq('role', 'organizer')
    .eq('is_verified', false)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to fetch pending organizers:', error)
    return { success: false, error: error.message }
  }

  if (!organizers || organizers.length === 0) {
    return { success: true, data: [] }
  }

  // Fetch campus names
  const campusIds = Array.from(
    new Set(organizers.map((o) => o.campus_id).filter(Boolean))
  ) as string[]
  const campusMap = new Map<string, string>()

  if (campusIds.length > 0) {
    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, name')
      .in('id', campusIds)

    if (campuses) {
      for (const c of campuses) {
        campusMap.set(c.id, c.name)
      }
    }
  }

  const result: PendingOrganizer[] = organizers.map((o) => ({
    ...o,
    campus_name: o.campus_id ? campusMap.get(o.campus_id) || 'Unknown Campus' : 'No Campus Assigned',
  }))

  return { success: true, data: result }
}

/**
 * Approve an organizer account, granting event publishing privileges and sending in-app notification.
 */
export async function approveOrganizer(organizerId: string): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can approve organizers.' }
  }

  // Update profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ is_verified: true })
    .eq('id', organizerId)

  if (updateError) {
    console.error('Failed to approve organizer:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send in-app notification to the approved organizer
  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Account Approved!',
      message: 'Congratulations! Your campus club organizer account has been approved. You can now create and publish campus events.',
      link: '/dashboard/events/new',
      is_read: false,
    })
  } catch (notifErr) {
    console.error('Failed to send organizer approval notification:', notifErr)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/moderation')
  revalidatePath('/settings')
  revalidatePath(`/organizers/${organizerId}`)

  return { success: true, data: { id: organizerId } }
}

/**
 * Reject an organizer application, reverting role to student and sending notification.
 */
export async function rejectOrganizer(
  organizerId: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can reject organizer applications.' }
  }

  // Revert role to student and ensure is_verified is false
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'student', is_verified: false })
    .eq('id', organizerId)

  if (updateError) {
    console.error('Failed to reject organizer:', updateError)
    return { success: false, error: updateError.message }
  }

  // Send notification to the user
  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Application Update',
      message: reason
        ? `Your request for organizer verification was not approved: ${reason}. Your account remains active as a student.`
        : 'Your request for organizer verification was not approved at this time. Your account remains active as a student.',
      link: '/settings',
      is_read: false,
    })
  } catch (notifErr) {
    console.error('Failed to send organizer rejection notification:', notifErr)
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/moderation')
  revalidatePath('/settings')

  return { success: true, data: { id: organizerId } }
}
