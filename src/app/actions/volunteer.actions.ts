'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageEvent } from '@/lib/auth/teams'
import type {
  ActionResult,
  EventVolunteerRole,
  EventVolunteerSignup,
  VolunteerSignupStatus,
} from '@/types'

/**
 * Fetch all volunteer roles for an event.
 */
export async function getEventVolunteerRoles(
  eventId: string
): Promise<ActionResult<EventVolunteerRole[]>> {
  const supabase = await createClient()

  const { data: roles, error } = await supabase
    .from('event_volunteer_roles')
    .select('*, event_volunteer_signups(id, status)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to get volunteer roles:', error)
    return { success: false, error: error.message }
  }

  const result: EventVolunteerRole[] = (roles || []).map((r) => {
    const signups = (r.event_volunteer_signups || []) as Array<{ id: string; status: string }>
    const approvedOrPending = signups.filter((s) => s.status === 'approved' || s.status === 'checked_in')
    return {
      id: r.id,
      event_id: r.event_id,
      title: r.title,
      description: r.description,
      required_skills: r.required_skills,
      shift_start: r.shift_start,
      shift_end: r.shift_end,
      capacity: r.capacity,
      created_at: r.created_at,
      signup_count: approvedOrPending.length,
      available_spots: Math.max(0, r.capacity - approvedOrPending.length),
    }
  })

  return { success: true, data: result }
}

/**
 * Create a new volunteer role for an event (organizers/editors only).
 */
export async function createVolunteerRole(
  eventId: string,
  data: {
    title: string
    description?: string | null
    required_skills?: string | null
    shift_start?: string | null
    shift_end?: string | null
    capacity?: number
  }
): Promise<ActionResult<EventVolunteerRole>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Only event owners and editors can create volunteer roles.' }
  }

  const title = data.title.trim()
  if (!title) {
    return { success: false, error: 'Role title is required.' }
  }

  const capacity = Math.max(1, data.capacity || 5)

  const { data: newRole, error } = await supabase
    .from('event_volunteer_roles')
    .insert({
      event_id: eventId,
      title,
      description: data.description?.trim() || null,
      required_skills: data.required_skills?.trim() || null,
      shift_start: data.shift_start || null,
      shift_end: data.shift_end || null,
      capacity,
    })
    .select()
    .single()

  if (error || !newRole) {
    console.error('Failed to create volunteer role:', error)
    return { success: false, error: error?.message || 'Failed to create role.' }
  }

  revalidatePath(`/dashboard/events/${eventId}/volunteers`)
  revalidatePath(`/events`)

  return {
    success: true,
    data: {
      id: newRole.id,
      event_id: newRole.event_id,
      title: newRole.title,
      description: newRole.description,
      required_skills: newRole.required_skills,
      shift_start: newRole.shift_start,
      shift_end: newRole.shift_end,
      capacity: newRole.capacity,
      created_at: newRole.created_at,
      signup_count: 0,
      available_spots: newRole.capacity,
    },
  }
}

/**
 * Delete a volunteer role (organizers/editors only).
 */
export async function deleteVolunteerRole(
  roleId: string,
  eventId: string
): Promise<ActionResult<{ deleted: boolean }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Unauthorized' }
  }

  const { error } = await supabase.from('event_volunteer_roles').delete().eq('id', roleId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath(`/dashboard/events/${eventId}/volunteers`)
  return { success: true, data: { deleted: true } }
}

/**
 * Apply or sign up for a volunteer role as a student.
 */
export async function applyForVolunteerRole(
  roleId: string,
  notes?: string
): Promise<ActionResult<EventVolunteerSignup>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to apply as a volunteer.' }
  }

  // 1. Fetch role details & verify capacity
  const { data: role, error: roleErr } = await supabase
    .from('event_volunteer_roles')
    .select('*, event_volunteer_signups(id, status)')
    .eq('id', roleId)
    .single()

  if (roleErr || !role) {
    return { success: false, error: 'Volunteer role not found.' }
  }

  const signups = (role.event_volunteer_signups || []) as Array<{ id: string; status: string }>
  const approvedCount = signups.filter((s) => s.status === 'approved' || s.status === 'checked_in').length
  if (approvedCount >= role.capacity) {
    return { success: false, error: 'This volunteer role has reached maximum capacity.' }
  }

  // 2. Check for existing signup
  const { data: existing } = await supabase
    .from('event_volunteer_signups')
    .select('id, status')
    .eq('role_id', roleId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'cancelled') {
      // Re-apply
      const { data: updated, error: updateErr } = await supabase
        .from('event_volunteer_signups')
        .update({
          status: 'pending',
          notes: notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (updateErr || !updated) {
        return { success: false, error: updateErr?.message || 'Failed to re-apply.' }
      }

      revalidatePath('/my-events')
      return {
        success: true,
        data: {
          id: updated.id,
          role_id: updated.role_id,
          event_id: updated.event_id,
          user_id: updated.user_id,
          status: updated.status as VolunteerSignupStatus,
          notes: updated.notes,
          checked_in_at: updated.checked_in_at,
          created_at: updated.created_at,
          updated_at: updated.updated_at,
        },
      }
    }

    return { success: false, error: `You have already applied for this role (Status: ${existing.status}).` }
  }

  // 3. Insert application
  const { data: newSignup, error: insertErr } = await supabase
    .from('event_volunteer_signups')
    .insert({
      role_id: roleId,
      event_id: role.event_id,
      user_id: user.id,
      status: 'pending',
      notes: notes?.trim() || null,
    })
    .select()
    .single()

  if (insertErr || !newSignup) {
    console.error('Failed to apply for volunteer role:', insertErr)
    return { success: false, error: insertErr?.message || 'Failed to submit application.' }
  }

  revalidatePath('/my-events')
  revalidatePath(`/dashboard/events/${role.event_id}/volunteers`)

  return {
    success: true,
    data: {
      id: newSignup.id,
      role_id: newSignup.role_id,
      event_id: newSignup.event_id,
      user_id: newSignup.user_id,
      status: newSignup.status as VolunteerSignupStatus,
      notes: newSignup.notes,
      checked_in_at: newSignup.checked_in_at,
      created_at: newSignup.created_at,
      updated_at: newSignup.updated_at,
    },
  }
}

/**
 * Fetch all volunteer applications for an event (organizer management station).
 */
export async function getEventVolunteerSignups(
  eventId: string
): Promise<ActionResult<EventVolunteerSignup[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Forbidden' }
  }

  const { data: signups, error } = await supabase
    .from('event_volunteer_signups')
    .select('*, event_volunteer_roles(*)')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const userIds = Array.from(new Set((signups || []).map((s) => s.user_id)))
  let profileMap = new Map<string, { id: string; full_name: string; email: string; avatar_url: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds)

    if (profiles) {
      profileMap = new Map(profiles.map((p) => [p.id, p]))
    }
  }

  const result: EventVolunteerSignup[] = (signups || []).map((s) => {
    const prof = profileMap.get(s.user_id)
    return {
      id: s.id,
      role_id: s.role_id,
      event_id: s.event_id,
      user_id: s.user_id,
      status: s.status as VolunteerSignupStatus,
      notes: s.notes,
      checked_in_at: s.checked_in_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
      role: s.event_volunteer_roles as unknown as EventVolunteerRole,
      user: prof ? {
        id: prof.id,
        full_name: prof.full_name,
        email: prof.email,
        avatar_url: prof.avatar_url,
      } : undefined,
    }
  })

  return { success: true, data: result }
}

/**
 * Update volunteer status (approve, decline, check-in, cancel).
 */
export async function updateVolunteerSignupStatus(
  signupId: string,
  eventId: string,
  status: VolunteerSignupStatus
): Promise<ActionResult<{ id: string; status: VolunteerSignupStatus }>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const role = await getEventUserRole(eventId, user.id)
  if (!canManageEvent(role)) {
    return { success: false, error: 'Unauthorized to manage volunteers.' }
  }

  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }

  if (status === 'checked_in') {
    payload.checked_in_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('event_volunteer_signups')
    .update(payload)
    .eq('id', signupId)
    .select()
    .single()

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to update volunteer status.' }
  }

  revalidatePath(`/dashboard/events/${eventId}/volunteers`)

  return { success: true, data: { id: data.id, status: data.status as VolunteerSignupStatus } }
}

/**
 * Fetch volunteer signups for current student across events.
 */
export async function getUserVolunteerSignups(): Promise<ActionResult<EventVolunteerSignup[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const { data, error } = await supabase
    .from('event_volunteer_signups')
    .select('*, event_volunteer_roles(*), events(id, title, slug, event_date, start_time, location)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { success: false, error: error.message }
  }

  const result: EventVolunteerSignup[] = (data || []).map((s) => ({
    id: s.id,
    role_id: s.role_id,
    event_id: s.event_id,
    user_id: s.user_id,
    status: s.status as VolunteerSignupStatus,
    notes: s.notes,
    checked_in_at: s.checked_in_at,
    created_at: s.created_at,
    updated_at: s.updated_at,
    role: s.event_volunteer_roles as unknown as EventVolunteerRole,
    event: s.events as unknown as {
      id: string
      title: string
      slug: string
      event_date: string
      start_time: string
      location: string
    },
  }))

  return { success: true, data: result }
}
