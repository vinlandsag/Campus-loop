'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { updateUserCampus } from '@/app/actions/campus.actions'
import { updateUserSocialPreferences } from '@/app/actions/friends.actions'
import { updatePhotoPrivacyPreference } from '@/app/actions/gallery.actions'
import { invalidateOrganizerCache } from '@/lib/cache/invalidation'
import type {
  AttendanceVisibility,
  PublicFieldsVisibility,
  SecurityAuditLog,
  SecurityAuditAction,
  AccountDeletionRequest,
  OrganizerWorkspaceSettings,
} from '@/types'

// Helper: Record security audit log
export async function recordSecurityAuditLog(
  userId: string,
  action: SecurityAuditAction | string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = await createClient()
    await supabase.from('security_audit_logs').insert({
      user_id: userId,
      action,
      details,
    })
  } catch (err) {
    console.error('Failed to record security audit log:', err)
  }
}

// ─── 1. Profile Actions ───────────────────────────────────────────────────────

export interface UpdateUserProfileInput {
  full_name: string
  preferred_name?: string | null
  bio?: string | null
  college?: string | null
  department?: string | null
  year?: string | null
  avatar_url?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  contact_email?: string | null
  public_fields_visibility?: PublicFieldsVisibility | null
}

export async function updateUserProfile(
  input: UpdateUserProfileInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const trimmedName = input.full_name?.trim()
  if (!trimmedName) {
    return { success: false, error: 'Full name is required.' }
  }

  // Security guard: Ensure protected fields cannot be injected
  const updateData: Record<string, unknown> = {
    full_name: trimmedName,
    preferred_name: input.preferred_name?.trim() || null,
    bio: input.bio?.trim() || null,
    college: input.college?.trim() || null,
    department: input.department?.trim() || null,
    year: input.year?.trim() || null,
    avatar_url: input.avatar_url?.trim() || null,
    website_url: input.website_url?.trim() || null,
    instagram_handle: input.instagram_handle?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    updated_at: new Date().toISOString(),
  }

  if (input.public_fields_visibility) {
    updateData.public_fields_visibility = input.public_fields_visibility
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (profileError) {
    console.error('Profile update error:', profileError)
    return { success: false, error: 'Failed to update profile.' }
  }

  // Sync full_name with auth user metadata for consistency
  await supabase.auth.updateUser({
    data: { full_name: trimmedName },
  })

  await recordSecurityAuditLog(user.id, 'organizer_profile_updated', {
    updated_fields: Object.keys(updateData).filter((k) => k !== 'updated_at'),
  })

  invalidateOrganizerCache(user.id)
  revalidatePath('/settings')
  revalidatePath('/', 'layout')

  return { success: true }
}

// ─── 2. Campus & Eligibility Actions ──────────────────────────────────────────

export async function checkCampusChangeImpact(
  _targetCampusId: string
): Promise<{
  success: boolean
  error?: string
  organizedEventsCount: number
  activeRegistrationsCount: number
  isOrganizer: boolean
  warning?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      error: 'Not authenticated',
      organizedEventsCount: 0,
      activeRegistrationsCount: 0,
      isOrganizer: false,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('campus_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return {
      success: false,
      error: 'Profile not found',
      organizedEventsCount: 0,
      activeRegistrationsCount: 0,
      isOrganizer: false,
    }
  }

  const isOrganizer = profile.role === 'organizer'

  // Check organized events
  let organizedEventsCount = 0
  if (isOrganizer) {
    const { count } = await supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('organizer_id', user.id)
      .neq('status', 'cancelled')
    organizedEventsCount = count || 0
  }

  // Check user active registrations
  const { count: regCount } = await supabase
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'registered')

  const activeRegistrationsCount = regCount || 0

  let warning: string | undefined
  if (isOrganizer && organizedEventsCount > 0) {
    warning = `You are an organizer with ${organizedEventsCount} active event(s). Changing your campus affiliation does NOT move your existing events across campuses. Existing events remain locked to their original campus for student safety.`
  }

  return {
    success: true,
    organizedEventsCount,
    activeRegistrationsCount,
    isOrganizer,
    warning,
  }
}

export async function requestCampusTransfer(
  targetCampusId: string,
  exceptionReason?: string
): Promise<{ success: boolean; error?: string; status?: string; pending?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const res = await updateUserCampus(targetCampusId, exceptionReason)

  if (res.success) {
    await recordSecurityAuditLog(user.id, 'campus_change_requested', {
      target_campus_id: targetCampusId,
      status: res.status,
      pending: res.pending,
      exception_reason: exceptionReason || null,
    })
  }

  return res
}

// ─── 3. Privacy & Social Actions ──────────────────────────────────────────────

export interface UpdatePrivacyAndSocialInput {
  default_attendance_visibility: AttendanceVisibility
  share_attendance_with_friends: boolean
  allow_friend_requests: boolean
  opt_out_photos: boolean
}

export async function updatePrivacyAndSocialSettings(
  input: UpdatePrivacyAndSocialInput
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const [socialRes, photoRes] = await Promise.all([
    updateUserSocialPreferences({
      share_attendance_with_friends: input.share_attendance_with_friends,
      default_attendance_visibility: input.default_attendance_visibility,
      allow_friend_requests: input.allow_friend_requests,
    }),
    updatePhotoPrivacyPreference(input.opt_out_photos),
  ])

  if (!socialRes.success) {
    return { success: false, error: socialRes.error }
  }
  if (!photoRes.success) {
    return { success: false, error: photoRes.error }
  }

  await recordSecurityAuditLog(user.id, 'privacy_updated', {
    default_attendance_visibility: input.default_attendance_visibility,
    share_attendance_with_friends: input.share_attendance_with_friends,
    allow_friend_requests: input.allow_friend_requests,
    opt_out_photos: input.opt_out_photos,
  })

  revalidatePath('/settings')
  return { success: true }
}

export interface BlockedUserRecord {
  id: string
  full_name: string
  avatar_url?: string | null
  created_at: string
}

export async function getBlockedUsers(): Promise<BlockedUserRecord[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('networking_blocks')
    .select('blocked_user_id, created_at, blocked_profile:profiles!networking_blocks_blocked_user_id_fkey(id, full_name, avatar_url)')
    .eq('user_id', user.id)

  if (error || !data) {
    return []
  }

  interface BlockedDbRow {
    blocked_user_id: string
    created_at: string
    blocked_profile?: { id?: string; full_name?: string; avatar_url?: string | null } | null
  }

  return (data as unknown as BlockedDbRow[]).map((d) => ({
    id: d.blocked_user_id,
    full_name: d.blocked_profile?.full_name || 'Campus Attendee',
    avatar_url: d.blocked_profile?.avatar_url || null,
    created_at: d.created_at,
  }))
}

export async function unblockUser(
  blockedUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('networking_blocks')
    .delete()
    .eq('user_id', user.id)
    .eq('blocked_user_id', blockedUserId)

  if (error) {
    return { success: false, error: error.message }
  }

  await recordSecurityAuditLog(user.id, 'user_unblocked', {
    unblocked_user_id: blockedUserId,
  })

  revalidatePath('/settings')
  return { success: true }
}

// ─── 4. Security & Session Actions ────────────────────────────────────────────

export async function changeAccountPassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' }
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  await recordSecurityAuditLog(user.id, 'password_changed', {
    timestamp: new Date().toISOString(),
  })

  return { success: true }
}

export async function revokeAllOtherSessions(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase.auth.signOut({ scope: 'others' })

  if (error) {
    return { success: false, error: error.message }
  }

  await recordSecurityAuditLog(user.id, 'session_revoked', {
    scope: 'others',
  })

  return { success: true }
}

export async function toggleTwoFactor(
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ two_factor_enabled: enabled })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  await recordSecurityAuditLog(user.id, 'two_factor_toggled', { enabled })

  revalidatePath('/settings')
  return { success: true }
}

export async function getSecurityAuditLogs(): Promise<SecurityAuditLog[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from('security_audit_logs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data) return []

  return data as unknown as SecurityAuditLog[]
}

// ─── 5. Personal Data & Account Deletion ───────────────────────────────────────

export async function exportPersonalData(): Promise<{
  success: boolean
  error?: string
  data?: Record<string, unknown>
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const [
    profileRes,
    registrationsRes,
    certificatesRes,
    volunteerRes,
    friendsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('registrations').select('id, event_id, status, ticket_code, created_at, events(title, event_date, location)').eq('user_id', user.id),
    supabase.from('event_certificates').select('id, certificate_code, event_id, issued_at, title, events(title)').eq('user_id', user.id),
    supabase.from('event_volunteer_signups').select('id, status, applied_at, role:event_volunteer_roles(title, event_id)').eq('user_id', user.id),
    supabase.from('friendships').select('id, friend_id, status, created_at').eq('user_id', user.id),
    supabase.from('security_audit_logs').select('action, details, created_at').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  const exportPayload = {
    metadata: {
      account_id: user.id,
      email: user.email,
      export_generated_at: new Date().toISOString(),
      platform: 'CampusLoop',
      gdpr_compliance_format: 'JSON v1.0',
    },
    profile: profileRes.data || null,
    registrations: registrationsRes.data || [],
    certificates: certificatesRes.data || [],
    volunteer_signups: volunteerRes.data || [],
    friendships: friendsRes.data || [],
    security_audit_logs: auditRes.data || [],
  }

  return {
    success: true,
    data: exportPayload,
  }
}

export async function requestAccountDeletion(
  confirmation: string,
  reason?: string
): Promise<{ success: boolean; error?: string; scheduledFor?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  if (confirmation.trim() !== 'DELETE MY ACCOUNT') {
    return {
      success: false,
      error: 'Please type "DELETE MY ACCOUNT" exactly to confirm your request.',
    }
  }

  // 14-day cancellation window
  const scheduledFor = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  // Insert scheduled deletion record
  const { error: reqError } = await supabase
    .from('account_deletion_requests')
    .insert({
      user_id: user.id,
      status: 'scheduled',
      scheduled_for: scheduledFor,
      reason: reason?.trim() || 'User initiated deletion',
    })

  if (reqError) {
    return { success: false, error: reqError.message }
  }

  // Mark deletion on profile
  await supabase
    .from('profiles')
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq('id', user.id)

  await recordSecurityAuditLog(user.id, 'account_deletion_requested', {
    scheduled_for: scheduledFor,
    reason: reason?.trim() || null,
  })

  revalidatePath('/settings')
  return { success: true, scheduledFor }
}

export async function cancelAccountDeletion(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error: cancelError } = await supabase
    .from('account_deletion_requests')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('status', 'scheduled')

  if (cancelError) {
    return { success: false, error: cancelError.message }
  }

  await supabase
    .from('profiles')
    .update({ deletion_requested_at: null })
    .eq('id', user.id)

  await recordSecurityAuditLog(user.id, 'account_deletion_cancelled', {
    cancelled_at: new Date().toISOString(),
  })

  revalidatePath('/settings')
  return { success: true }
}

export async function getAccountDeletionRequest(): Promise<AccountDeletionRequest | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('account_deletion_requests')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'scheduled')
    .maybeSingle()

  return (data as unknown as AccountDeletionRequest) || null
}

// ─── 6. Organizer Workspace Actions ───────────────────────────────────────────

export async function getOrganizerWorkspaceSettings(): Promise<OrganizerWorkspaceSettings | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'organizer') {
    return null
  }

  let { data: settings } = await supabase
    .from('organizer_workspace_settings')
    .select('*')
    .eq('organizer_id', user.id)
    .maybeSingle()

  // If none exists, create default row
  if (!settings) {
    const { data: created } = await supabase
      .from('organizer_workspace_settings')
      .insert({ organizer_id: user.id })
      .select()
      .single()
    settings = created
  }

  return (settings as unknown as OrganizerWorkspaceSettings) || null
}

export async function updateOrganizerWorkspaceSettings(
  input: Partial<OrganizerWorkspaceSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_verified')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'organizer') {
    return { success: false, error: 'Unauthorized: Only organizers can manage workspace settings.' }
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (input.default_timezone !== undefined) updateData.default_timezone = input.default_timezone
  if (input.default_venue_id !== undefined) updateData.default_venue_id = input.default_venue_id || null
  if (input.default_category !== undefined) updateData.default_category = input.default_category
  if (input.default_accessibility_statement !== undefined)
    updateData.default_accessibility_statement = input.default_accessibility_statement || null
  if (input.default_contact_email !== undefined)
    updateData.default_contact_email = input.default_contact_email || null
  if (input.notify_on_new_registration !== undefined)
    updateData.notify_on_new_registration = input.notify_on_new_registration
  if (input.notify_on_volunteer_application !== undefined)
    updateData.notify_on_volunteer_application = input.notify_on_volunteer_application
  if (input.notify_on_event_feedback !== undefined)
    updateData.notify_on_event_feedback = input.notify_on_event_feedback
  if (input.default_team_invites_enabled !== undefined)
    updateData.default_team_invites_enabled = input.default_team_invites_enabled

  const { error } = await supabase
    .from('organizer_workspace_settings')
    .update(updateData)
    .eq('organizer_id', user.id)

  if (error) {
    return { success: false, error: error.message }
  }

  await recordSecurityAuditLog(user.id, 'organizer_workspace_updated', {
    fields: Object.keys(updateData).filter((k) => k !== 'updated_at'),
  })

  invalidateOrganizerCache(user.id)
  revalidatePath('/settings')
  return { success: true }
}

// ─── 7. Test Notification Dispatch ───────────────────────────────────────────

export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { error } = await supabase.from('notifications').insert({
    user_id: user.id,
    title: '🔔 Test Notification',
    message: 'Your CampusLoop delivery preferences are active and working smoothly!',
    type: 'announcement',
    is_read: false,
    email_status: 'sent',
    email_sent_at: new Date().toISOString(),
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}
