'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getAdminUser, logAdminAction } from '@/lib/auth/admin'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'
import type {
  ActionResult,
  AdminAuditLogEntry,
  AdminCampusException,
  AdminCampusWithCounts,
  AdminDashboardOverview,
  AdminEvent,
  AdminOrganizer,
  ModerationReport,
  ModerationReportStatus,
  OrganizerApprovalStatus,
} from '@/types'

// ─── Rate Limiting Helper ────────────────────────────────────────────────────

async function adminRateLimit(
  adminId: string,
  action: string
): Promise<{ allowed: boolean; error?: string }> {
  const supabase = await createClient()
  const result = await checkDurableRateLimit(supabase, {
    key: `admin:${adminId}`,
    action,
    maxRequests: 60,
    windowSeconds: 60,
  })
  if (!result.allowed) {
    return { allowed: false, error: 'Rate limit exceeded. Please wait before retrying.' }
  }
  return { allowed: true }
}

// ─── Dashboard Overview ──────────────────────────────────────────────────────

export async function adminGetDashboardOverview(): Promise<ActionResult<AdminDashboardOverview>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const [
    { count: pendingOrganizers },
    { count: pendingReports },
    { count: flaggedEvents },
    { count: totalCampuses },
    { count: activeCampuses },
    { count: totalEvents },
    { count: recentAuditCount },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'organizer')
      .eq('is_verified', false)
      .eq('is_suspended', false),
    supabase
      .from('moderation_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('moderation_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'investigating'),
    supabase.from('campuses').select('*', { count: 'exact', head: true }),
    supabase.from('campuses').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('events').select('*', { count: 'exact', head: true }),
    supabase
      .from('admin_audit_log')
      .select('*', { count: 'exact', head: true }),
  ])

  return {
    success: true,
    data: {
      pendingOrganizers: pendingOrganizers ?? 0,
      pendingReports: pendingReports ?? 0,
      flaggedEvents: flaggedEvents ?? 0,
      totalCampuses: totalCampuses ?? 0,
      activeCampuses: activeCampuses ?? 0,
      totalEvents: totalEvents ?? 0,
      recentAuditCount: recentAuditCount ?? 0,
    },
  }
}

// ─── Organizer Management ────────────────────────────────────────────────────

function deriveApprovalStatus(profile: {
  role: string
  is_verified: boolean
  is_suspended: boolean
}): OrganizerApprovalStatus {
  if (profile.is_suspended) return 'suspended'
  if (profile.role !== 'organizer') return 'revoked'
  if (profile.is_verified) return 'approved'
  return 'pending'
}

export async function adminGetOrganizers(options?: {
  status?: OrganizerApprovalStatus
  search?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ organizers: AdminOrganizer[]; total: number }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  // We fetch organizer-role profiles and recently-revoked ones
  let query = supabase
    .from('profiles')
    .select(
      'id, email, full_name, role, is_verified, is_suspended, campus_id, campus_verification_status, college, department, bio, website_url, instagram_handle, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  // Filter based on status
  if (options?.status === 'pending') {
    query = query.eq('role', 'organizer').eq('is_verified', false).eq('is_suspended', false)
  } else if (options?.status === 'approved') {
    query = query.eq('role', 'organizer').eq('is_verified', true).eq('is_suspended', false)
  } else if (options?.status === 'suspended') {
    query = query.eq('is_suspended', true)
  } else {
    // All organizers (current or former)
    query = query.eq('role', 'organizer')
  }

  if (options?.search) {
    query = query.or(`full_name.ilike.%${options.search}%,email.ilike.%${options.search}%`)
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query

  if (error) {
    console.error('Failed to fetch organizers:', error)
    return { success: false, error: error.message }
  }

  // Fetch campus names
  const campusIds = Array.from(
    new Set((data || []).map((o) => o.campus_id).filter(Boolean))
  ) as string[]
  const campusMap = new Map<string, string>()
  if (campusIds.length > 0) {
    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, name')
      .in('id', campusIds)
    if (campuses) {
      for (const c of campuses) campusMap.set(c.id, c.name)
    }
  }

  const organizers: AdminOrganizer[] = (data || []).map((o) => ({
    ...o,
    is_suspended: Boolean(o.is_suspended),
    campus_name: o.campus_id ? campusMap.get(o.campus_id) || 'Unknown' : null,
    approval_status: deriveApprovalStatus({
      role: o.role,
      is_verified: o.is_verified,
      is_suspended: Boolean(o.is_suspended),
    }),
  }))

  return { success: true, data: { organizers, total: count ?? 0 } }
}

export async function adminApproveOrganizer(
  organizerId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_approve_organizer')
  if (!rl.allowed) return { success: false, error: rl.error! }

  // Verify target exists and is pending
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, is_verified, full_name')
    .eq('id', organizerId)
    .single()

  if (!profile) return { success: false, error: 'Organizer not found' }
  if (profile.is_verified) return { success: false, error: 'Organizer is already verified' }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      is_verified: true,
      is_suspended: false,
      campus_verification_status: 'verified',
      campus_verified_at: new Date().toISOString(),
    })
    .eq('id', organizerId)

  if (updateError) return { success: false, error: updateError.message }

  // Audit log
  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'organizer_approved',
    targetType: 'user',
    targetId: organizerId,
    metadata: { organizer_name: profile.full_name },
  })

  // Notification
  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Account Approved!',
      message:
        'Congratulations! Your campus club organizer account has been approved. You can now create and publish campus events.',
      link: '/dashboard/events/new',
      is_read: false,
    })
  } catch {
    // Non-critical
  }

  revalidatePath('/admin/organizers')
  revalidatePath('/admin')
  return { success: true, data: { id: organizerId } }
}

export async function adminRejectOrganizer(
  organizerId: string,
  reason?: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_reject_organizer')
  if (!rl.allowed) return { success: false, error: rl.error! }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', organizerId)
    .single()
  if (!profile) return { success: false, error: 'Organizer not found' }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'student', is_verified: false })
    .eq('id', organizerId)

  if (updateError) return { success: false, error: updateError.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'organizer_rejected',
    targetType: 'user',
    targetId: organizerId,
    reason: reason || null,
    metadata: { organizer_name: profile.full_name },
  })

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
  } catch {
    // Non-critical
  }

  revalidatePath('/admin/organizers')
  revalidatePath('/admin')
  return { success: true, data: { id: organizerId } }
}

export async function adminSuspendOrganizer(
  organizerId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_suspend_organizer')
  if (!rl.allowed) return { success: false, error: rl.error! }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', organizerId)
    .single()
  if (!profile) return { success: false, error: 'Organizer not found' }

  // Suspend profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspension_reason: reason,
    })
    .eq('id', organizerId)

  if (updateError) return { success: false, error: updateError.message }

  // Unpublish active events
  await supabase
    .from('events')
    .update({ status: 'cancelled', cancellation_reason: 'Organizer suspended by CampusLoop moderation.' })
    .eq('organizer_id', organizerId)
    .eq('status', 'published')

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'organizer_suspended',
    targetType: 'user',
    targetId: organizerId,
    reason,
    metadata: { organizer_name: profile.full_name },
  })

  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'organizer_suspended',
      title: 'Organizer Account Suspended',
      message: `Your organizer account has been suspended: ${reason}. Your active events have been unpublished. Contact support for more information.`,
      link: '/settings',
      is_read: false,
    })
  } catch {
    // Non-critical
  }

  revalidatePath('/admin/organizers')
  revalidatePath('/admin')
  return { success: true, data: { id: organizerId } }
}

export async function adminUnsuspendOrganizer(
  organizerId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_unsuspend_organizer')
  if (!rl.allowed) return { success: false, error: rl.error! }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', organizerId)
    .single()
  if (!profile) return { success: false, error: 'Organizer not found' }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      is_suspended: false,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq('id', organizerId)

  if (updateError) return { success: false, error: updateError.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'organizer_unsuspended',
    targetType: 'user',
    targetId: organizerId,
    metadata: { organizer_name: profile.full_name },
  })

  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Account Reinstated',
      message: 'Your organizer account suspension has been lifted. You can now publish events again.',
      link: '/dashboard',
      is_read: false,
    })
  } catch {
    // Non-critical
  }

  revalidatePath('/admin/organizers')
  revalidatePath('/admin')
  return { success: true, data: { id: organizerId } }
}

export async function adminRevokeOrganizer(
  organizerId: string,
  reason: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_revoke_organizer')
  if (!rl.allowed) return { success: false, error: rl.error! }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('id', organizerId)
    .single()
  if (!profile) return { success: false, error: 'Organizer not found' }

  // Revert role to student, keep is_verified false
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'student', is_verified: false, is_suspended: false })
    .eq('id', organizerId)

  if (updateError) return { success: false, error: updateError.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'organizer_revoked',
    targetType: 'user',
    targetId: organizerId,
    reason,
    metadata: { organizer_name: profile.full_name },
  })

  try {
    await supabase.from('notifications').insert({
      user_id: organizerId,
      type: 'organizer_revoked',
      title: 'Organizer Access Revoked',
      message: `Your organizer privileges have been revoked: ${reason}. Your account remains active as a student.`,
      link: '/settings',
      is_read: false,
    })
  } catch {
    // Non-critical
  }

  revalidatePath('/admin/organizers')
  revalidatePath('/admin')
  return { success: true, data: { id: organizerId } }
}

// ─── Campus Management ───────────────────────────────────────────────────────

export async function adminGetCampuses(): Promise<ActionResult<AdminCampusWithCounts[]>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const { data: campuses, error } = await supabase
    .from('campuses')
    .select('*')
    .order('name', { ascending: true })

  if (error) return { success: false, error: error.message }

  // Get user counts per campus
  const result: AdminCampusWithCounts[] = []
  for (const campus of campuses || []) {
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('campus_id', campus.id)

    const { count: verifiedUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('campus_id', campus.id)
      .eq('campus_verification_status', 'verified')

    const { count: eventCount } = await supabase
      .from('events')
      .select('*', { count: 'exact', head: true })
      .eq('campus_id', campus.id)

    result.push({
      ...campus,
      approved_domains: campus.approved_domains || [],
      verified_user_count: verifiedUsers ?? 0,
      total_user_count: totalUsers ?? 0,
      event_count: eventCount ?? 0,
    })
  }

  return { success: true, data: result }
}

export async function adminCreateCampus(input: {
  name: string
  slug: string
  approved_domains: string[]
}): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_create_campus')
  if (!rl.allowed) return { success: false, error: rl.error! }

  // Validate
  if (!input.name.trim()) return { success: false, error: 'Campus name is required' }
  if (!input.slug.trim()) return { success: false, error: 'Campus slug is required' }
  if (!/^[a-z0-9-]+$/.test(input.slug)) return { success: false, error: 'Slug must be lowercase alphanumeric with hyphens only' }

  // Validate domains
  const domains = input.approved_domains
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d.length > 0)
  for (const domain of domains) {
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
      return { success: false, error: `Invalid domain format: ${domain}` }
    }
  }

  // Check for duplicate domains across campuses
  if (domains.length > 0) {
    const { data: existing } = await supabase.from('campuses').select('name, approved_domains')
    for (const campus of existing || []) {
      for (const d of domains) {
        if (campus.approved_domains?.includes(d)) {
          return { success: false, error: `Domain "${d}" is already assigned to campus "${campus.name}"` }
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('campuses')
    .insert({
      name: input.name.trim(),
      slug: input.slug.trim(),
      approved_domains: domains,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'campus_created',
    targetType: 'campus',
    targetId: data.id,
    metadata: { name: input.name, slug: input.slug, domains },
  })

  revalidatePath('/admin/colleges')
  return { success: true, data: { id: data.id } }
}

export async function adminUpdateCampus(
  campusId: string,
  input: { name?: string; slug?: string; is_active?: boolean }
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_update_campus')
  if (!rl.allowed) return { success: false, error: rl.error! }

  const updatePayload: Record<string, unknown> = {}
  if (input.name !== undefined) updatePayload['name'] = input.name.trim()
  if (input.slug !== undefined) {
    if (!/^[a-z0-9-]+$/.test(input.slug)) return { success: false, error: 'Slug must be lowercase alphanumeric with hyphens only' }
    updatePayload['slug'] = input.slug.trim()
  }
  if (input.is_active !== undefined) updatePayload['is_active'] = input.is_active

  const { error } = await supabase.from('campuses').update(updatePayload).eq('id', campusId)
  if (error) return { success: false, error: error.message }

  const actionName = input.is_active === false ? 'campus_deactivated' : 'campus_updated'
  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: actionName,
    targetType: 'campus',
    targetId: campusId,
    metadata: { changes: input },
  })

  revalidatePath('/admin/colleges')
  return { success: true, data: { id: campusId } }
}

export async function adminAddDomain(
  campusId: string,
  domain: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const cleanDomain = domain.trim().toLowerCase()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleanDomain)) {
    return { success: false, error: `Invalid domain format: ${cleanDomain}` }
  }

  // Check duplicate across all campuses
  const { data: allCampuses } = await supabase.from('campuses').select('id, name, approved_domains')
  for (const campus of allCampuses || []) {
    if (campus.approved_domains?.includes(cleanDomain)) {
      if (campus.id === campusId) {
        return { success: false, error: `Domain "${cleanDomain}" is already assigned to this campus` }
      }
      return { success: false, error: `Domain "${cleanDomain}" is already assigned to campus "${campus.name}"` }
    }
  }

  // Get current campus
  const currentCampus = (allCampuses || []).find((c) => c.id === campusId)
  if (!currentCampus) return { success: false, error: 'Campus not found' }

  const newDomains = [...(currentCampus.approved_domains || []), cleanDomain]
  const { error } = await supabase
    .from('campuses')
    .update({ approved_domains: newDomains })
    .eq('id', campusId)

  if (error) return { success: false, error: error.message }

  // Auto-verify existing profiles matching the newly approved domain
  try {
    await supabase
      .from('profiles')
      .update({
        campus_id: campusId,
        campus_verification_status: 'verified',
        campus_verified_at: new Date().toISOString(),
      })
      .ilike('email', `%@${cleanDomain}`)
      .eq('campus_verification_status', 'unverified')
  } catch (err) {
    console.error('Error auto-verifying users for new domain:', err)
  }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'domain_added',
    targetType: 'campus',
    targetId: campusId,
    metadata: { domain: cleanDomain },
  })

  revalidatePath('/admin/colleges')
  return { success: true, data: { id: campusId } }
}

export async function adminRemoveDomain(
  campusId: string,
  domain: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const { data: campus } = await supabase
    .from('campuses')
    .select('approved_domains')
    .eq('id', campusId)
    .single()

  if (!campus) return { success: false, error: 'Campus not found' }

  const newDomains = (campus.approved_domains || []).filter(
    (d: string) => d.toLowerCase() !== domain.toLowerCase()
  )

  const { error } = await supabase
    .from('campuses')
    .update({ approved_domains: newDomains })
    .eq('id', campusId)

  if (error) return { success: false, error: error.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'domain_removed',
    targetType: 'campus',
    targetId: campusId,
    metadata: { domain },
  })

  revalidatePath('/admin/colleges')
  return { success: true, data: { id: campusId } }
}

export async function adminGetCampusExceptions(): Promise<ActionResult<AdminCampusException[]>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, campus_id, pending_campus_id, campus_exception_reason, campus_verification_status, created_at')
    .eq('campus_verification_status', 'pending')
    .not('pending_campus_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return { success: false, error: error.message }
  if (!data || data.length === 0) return { success: true, data: [] }

  // Fetch campus names
  const allCampusIds = Array.from(
    new Set([
      ...(data.map((p) => p.campus_id).filter(Boolean) as string[]),
      ...(data.map((p) => p.pending_campus_id).filter(Boolean) as string[]),
    ])
  )
  const campusMap = new Map<string, string>()
  if (allCampusIds.length > 0) {
    const { data: campuses } = await supabase
      .from('campuses')
      .select('id, name')
      .in('id', allCampusIds)
    for (const c of campuses || []) campusMap.set(c.id, c.name)
  }

  const exceptions: AdminCampusException[] = data.map((p) => ({
    user_id: p.id,
    full_name: p.full_name,
    email: p.email,
    current_campus_name: p.campus_id ? campusMap.get(p.campus_id) || null : null,
    pending_campus_name: p.pending_campus_id ? campusMap.get(p.pending_campus_id) || null : null,
    pending_campus_id: p.pending_campus_id,
    exception_reason: p.campus_exception_reason,
    campus_verification_status: p.campus_verification_status,
    created_at: p.created_at,
  }))

  return { success: true, data: exceptions }
}

export async function adminApproveCampusException(
  userId: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const { data: profile } = await supabase
    .from('profiles')
    .select('pending_campus_id, full_name')
    .eq('id', userId)
    .single()

  if (!profile?.pending_campus_id) {
    return { success: false, error: 'User does not have a pending campus request.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      campus_id: profile.pending_campus_id,
      pending_campus_id: null,
      campus_verification_status: 'exception',
      campus_verified_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) return { success: false, error: error.message }

  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: 'campus_exception_approved',
    targetType: 'user',
    targetId: userId,
    metadata: { user_name: profile.full_name, campus_id: profile.pending_campus_id },
  })

  revalidatePath('/admin/colleges')
  return { success: true, data: { id: userId } }
}

// ─── Event Management ────────────────────────────────────────────────────────

export async function adminGetEvents(options?: {
  search?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ events: AdminEvent[]; total: number }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  let query = supabase
    .from('events')
    .select(
      'id, title, slug, status, category, organizer_id, campus_id, capacity, event_date, start_time, end_time, created_at',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  if (options?.search) {
    query = query.or(`title.ilike.%${options.search}%,slug.ilike.%${options.search}%`)
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) return { success: false, error: error.message }

  // Fetch organizer names and campus names
  const organizerIds = Array.from(new Set((data || []).map((e) => e.organizer_id)))
  const campusIds = Array.from(new Set((data || []).map((e) => e.campus_id).filter(Boolean))) as string[]

  const organizerMap = new Map<string, { name: string; verified: boolean }>()
  if (organizerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, is_verified')
      .in('id', organizerIds)
    for (const p of profiles || []) {
      organizerMap.set(p.id, { name: p.full_name, verified: p.is_verified })
    }
  }

  const campusMap = new Map<string, string>()
  if (campusIds.length > 0) {
    const { data: campuses } = await supabase.from('campuses').select('id, name').in('id', campusIds)
    for (const c of campuses || []) campusMap.set(c.id, c.name)
  }

  // Get registration counts
  const eventIds = (data || []).map((e) => e.id)
  const regCountMap = new Map<string, number>()
  if (eventIds.length > 0) {
    for (const eventId of eventIds) {
      const { count: regCount } = await supabase
        .from('registrations')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .in('status', ['registered', 'checked_in'])
      regCountMap.set(eventId, regCount ?? 0)
    }
  }

  const events: AdminEvent[] = (data || []).map((e) => ({
    id: e.id,
    title: e.title,
    slug: e.slug,
    status: e.status,
    category: e.category,
    organizer_id: e.organizer_id,
    organizer_name: organizerMap.get(e.organizer_id)?.name || 'Unknown',
    organizer_verified: organizerMap.get(e.organizer_id)?.verified || false,
    campus_id: e.campus_id,
    campus_name: e.campus_id ? campusMap.get(e.campus_id) || null : null,
    registration_count: regCountMap.get(e.id) || 0,
    capacity: e.capacity,
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    created_at: e.created_at,
  }))

  return { success: true, data: { events, total: count ?? 0 } }
}

export async function adminDeleteEvent(
  eventId: string,
  reason: string,
  adminNotes?: string
): Promise<ActionResult<{ deletedTitle: string; affectedUsers: number }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const rl = await adminRateLimit(auth.user.id, 'admin_delete_event')
  if (!rl.allowed) return { success: false, error: rl.error! }

  if (!reason.trim()) {
    return { success: false, error: 'A reason is required for event deletion' }
  }

  const { data, error } = await supabase.rpc('admin_delete_event', {
    p_event_id: eventId,
    p_reason: reason.trim(),
    p_admin_notes: adminNotes?.trim() || null,
  })

  if (error) {
    console.error('admin_delete_event RPC error:', error)
    return { success: false, error: error.message }
  }

  const result = data as unknown as { success: boolean; error?: string; deleted_event_title?: string; affected_users?: number }
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to delete event' }
  }

  revalidatePath('/admin/events')
  revalidatePath('/admin')
  revalidatePath('/events')

  return {
    success: true,
    data: {
      deletedTitle: result.deleted_event_title || 'Unknown',
      affectedUsers: result.affected_users || 0,
    },
  }
}

// ─── Moderation Reports ──────────────────────────────────────────────────────

export async function adminGetReports(options?: {
  status?: ModerationReportStatus
  search?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ reports: ModerationReport[]; total: number }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  let query = supabase
    .from('moderation_reports')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: { reports: (data || []) as ModerationReport[], total: count ?? 0 },
  }
}

export async function adminUpdateReport(
  reportId: string,
  action: 'dismiss' | 'investigate' | 'action_taken',
  adminNotes?: string
): Promise<ActionResult<ModerationReport>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  const statusMap: Record<string, ModerationReportStatus> = {
    dismiss: 'dismissed',
    investigate: 'investigating',
    action_taken: 'action_taken',
  }

  const payload: Record<string, unknown> = {
    status: statusMap[action],
    reviewed_by: auth.user.id,
    reviewed_at: new Date().toISOString(),
  }
  if (adminNotes !== undefined) {
    payload['admin_notes'] = adminNotes?.trim() || null
  }

  const { data, error } = await supabase
    .from('moderation_reports')
    .update(payload)
    .eq('id', reportId)
    .select('*')
    .single()

  if (error) return { success: false, error: error.message }

  const auditAction = action === 'dismiss' ? 'report_dismissed' : action === 'investigate' ? 'report_investigated' : 'report_action_taken'
  await logAdminAction(supabase, {
    adminId: auth.user.id,
    action: auditAction,
    targetType: 'report',
    targetId: reportId,
    metadata: { new_status: statusMap[action], admin_notes: adminNotes },
  })

  revalidatePath('/admin/reports')
  revalidatePath('/admin')
  return { success: true, data: data as ModerationReport }
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export async function adminGetAuditLog(options?: {
  action?: string
  limit?: number
  offset?: number
}): Promise<ActionResult<{ entries: AdminAuditLogEntry[]; total: number }>> {
  const supabase = await createClient()
  const auth = await getAdminUser(supabase)
  if (!auth.authorized) return { success: false, error: auth.error }

  let query = supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })

  if (options?.action) {
    query = query.eq('action', options.action)
  }

  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0
  query = query.range(offset, offset + limit - 1)

  const { data, count, error } = await query
  if (error) return { success: false, error: error.message }

  return {
    success: true,
    data: { entries: (data || []) as AdminAuditLogEntry[], total: count ?? 0 },
  }
}
