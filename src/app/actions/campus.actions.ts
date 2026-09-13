'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import { measureDevPerf } from '@/lib/diagnostics/perf'
import { getCachedActiveCampuses } from '@/lib/cache/public-cache'
import type { Campus, CampusVerificationStatus } from '@/types'

export async function getActiveCampuses(): Promise<Campus[]> {
  return measureDevPerf('campus:lookup', async () => {
    return getCachedActiveCampuses()
  })
}

export interface UserCampusDetails {
  campus: Campus | null
  status: CampusVerificationStatus
  pendingCampus: Campus | null
  exceptionReason: string | null
  verifiedAt: string | null
}

export async function getUserCampusDetails(): Promise<UserCampusDetails | null> {
  return measureDevPerf('campus:lookup', async () => {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('campus_id, campus_verification_status, campus_exception_reason, campus_verified_at, pending_campus_id')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) return null

      let campus: Campus | null = null
      if (profile.campus_id) {
        const { data: cData } = await supabase
          .from('campuses')
          .select('*')
          .eq('id', profile.campus_id)
          .maybeSingle()
        campus = (cData as unknown as Campus) || null
      }

      let pendingCampus: Campus | null = null
      if (profile.pending_campus_id) {
        const { data: pData } = await supabase
          .from('campuses')
          .select('*')
          .eq('id', profile.pending_campus_id)
          .maybeSingle()
        pendingCampus = (pData as unknown as Campus) || null
      }

      return {
        campus,
        status: (profile.campus_verification_status as CampusVerificationStatus) || 'unverified',
        pendingCampus,
        exceptionReason: profile.campus_exception_reason || null,
        verifiedAt: profile.campus_verified_at || null,
      }
    } catch (err) {
      console.error('Error fetching user campus details:', err)
      return null
    }
  })
}

export async function getUserCampus(): Promise<Campus | null> {
  const details = await getUserCampusDetails()
  return details?.campus || null
}

/**
 * Update user campus following the controlled verification lifecycle.
 */
export async function updateUserCampus(
  campusId: string,
  exceptionReason?: string
): Promise<{
  success: boolean
  error?: string
  status?: CampusVerificationStatus
  campus?: Campus
  pending?: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to set your campus.' }
  }

  // Verify campus exists and is active
  const { data: campus, error: campusError } = await supabase
    .from('campuses')
    .select('*')
    .eq('id', campusId)
    .eq('is_active', true)
    .maybeSingle()

  if (campusError || !campus) {
    return { success: false, error: 'Selected campus is not available.' }
  }

  const userEmail = user.email || ''
  const userDomain = userEmail.split('@')[1]?.toLowerCase() || ''
  const hasApprovedDomains = Boolean(campus.approved_domains && campus.approved_domains.length > 0)
  const isDomainApproved = hasApprovedDomains
    ? campus.approved_domains.some((d: string) => d.toLowerCase() === userDomain)
    : true

  // Check email confirmation status from auth user
  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at)

  // 1. If domain matches and email is confirmed -> direct verification
  if (isDomainApproved && isEmailConfirmed) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        campus_id: campusId,
        campus_verification_status: 'verified',
        campus_verified_at: new Date().toISOString(),
        pending_campus_id: null,
        campus_exception_reason: null,
      })
      .eq('id', user.id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/events')
    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/settings')

    return { success: true, status: 'verified', campus: campus as unknown as Campus }
  }

  // 2. If domain matches but email is not yet confirmed -> set campus but mark unverified
  if (isDomainApproved && !isEmailConfirmed) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        campus_id: campusId,
        campus_verification_status: 'unverified',
        pending_campus_id: null,
      })
      .eq('id', user.id)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/events')
    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/settings')

    return {
      success: true,
      status: 'unverified',
      campus: campus as unknown as Campus,
      error: 'Campus associated. Please confirm your campus email to complete verification.',
    }
  }

  // 3. Domain mismatch -> Controlled campus change: enter pending review state
  const reasonText = exceptionReason?.trim() || 'Cross-campus affiliation request'
  const { error: pendingError } = await supabase
    .from('profiles')
    .update({
      pending_campus_id: campusId,
      campus_verification_status: 'pending',
      campus_exception_reason: reasonText,
    })
    .eq('id', user.id)

  if (pendingError) {
    return { success: false, error: pendingError.message }
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')

  return {
    success: false,
    pending: true,
    status: 'pending',
    error: `Your email domain (@${userDomain}) does not match ${campus.name}. A campus verification exception request has been submitted for administrator review.`,
  }
}

/**
 * Approve an exception request for a user's campus membership.
 */
export async function approveCampusException(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  // Verify caller is admin using durable server-controlled model
  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    return { success: false, error: 'Only administrators can approve campus exceptions.' }
  }

  // Fetch user's pending campus
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('pending_campus_id')
    .eq('id', userId)
    .single()

  if (!targetProfile?.pending_campus_id) {
    return { success: false, error: 'User does not have a pending campus request.' }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      campus_id: targetProfile.pending_campus_id,
      pending_campus_id: null,
      campus_verification_status: 'exception',
      campus_verified_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (updateError) {
    return { success: false, error: updateError.message }
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

