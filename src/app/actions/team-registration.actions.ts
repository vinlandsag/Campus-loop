'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { EventRegistrationTeam, EventRegistrationTeamMember } from '@/types'

export async function createRegistrationTeam(
  eventId: string,
  teamName: string,
  eventSlug?: string
): Promise<{
  success: boolean
  teamId?: string
  inviteCode?: string
  teamName?: string
  status?: string
  minTeamSize?: number
  maxTeamSize?: number
  error?: string
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_registration_team', {
    p_event_id: eventId,
    p_team_name: teamName,
  })

  if (error) {
    if (error.message.includes('gen_random_bytes') || error.code === '42883') {
      return await createRegistrationTeamFallback(supabase, eventId, teamName, eventSlug)
    }
    return { success: false, error: error.message }
  }

  const result = data as {
    success: boolean
    team_id?: string
    invite_code?: string
    team_name?: string
    status?: string
    min_team_size?: number
    max_team_size?: number
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to create team' }
  }

  if (eventSlug) {
    revalidatePath(`/events/${eventSlug}`)
  }

  return {
    success: true,
    teamId: result.team_id,
    inviteCode: result.invite_code,
    teamName: result.team_name,
    status: result.status,
    minTeamSize: result.min_team_size,
    maxTeamSize: result.max_team_size,
  }
}

export async function joinRegistrationTeam(
  inviteCode: string,
  eventSlug?: string
): Promise<{
  success: boolean
  teamId?: string
  teamName?: string
  status?: string
  memberCount?: number
  minTeamSize?: number
  maxTeamSize?: number
  error?: string
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('join_registration_team', {
    p_invite_code: inviteCode,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as {
    success: boolean
    team_id?: string
    team_name?: string
    status?: string
    member_count?: number
    min_team_size?: number
    max_team_size?: number
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to join team' }
  }

  if (eventSlug) {
    revalidatePath(`/events/${eventSlug}`)
  }

  return {
    success: true,
    teamId: result.team_id,
    teamName: result.team_name,
    status: result.status,
    memberCount: result.member_count,
    minTeamSize: result.min_team_size,
    maxTeamSize: result.max_team_size,
  }
}

export async function leaveRegistrationTeam(
  teamId: string,
  eventSlug?: string
): Promise<{
  success: boolean
  action?: 'left' | 'disbanded'
  error?: string
}> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('leave_registration_team', {
    p_team_id: teamId,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  const result = data as {
    success: boolean
    action?: 'left' | 'disbanded'
    error?: string
  }

  if (!result?.success) {
    return { success: false, error: result?.error || 'Failed to leave team' }
  }

  if (eventSlug) {
    revalidatePath(`/events/${eventSlug}`)
  }

  return {
    success: true,
    action: result.action,
  }
}

export async function getTeamByInviteCode(inviteCode: string): Promise<{
  success: boolean
  team?: {
    id: string
    name: string
    eventId: string
    status: string
    leaderName?: string
    memberCount: number
    minTeamSize: number
    maxTeamSize: number
  }
  error?: string
}> {
  const supabase = await createClient()
  const cleanCode = inviteCode.trim().toUpperCase()

  const { data: team, error: teamErr } = await supabase
    .from('event_registration_teams')
    .select(`
      id,
      name,
      event_id,
      status,
      leader_id,
      events!inner(min_team_size, max_team_size, title, slug)
    `)
    .eq('invite_code', cleanCode)
    .neq('status', 'disbanded')
    .maybeSingle()

  if (teamErr || !team) {
    return { success: false, error: 'Team not found or invite code invalid' }
  }

  // Count current members
  const { count: memberCount } = await supabase
    .from('event_registration_team_members')
    .select('*', { count: 'exact', head: true })
    .eq('team_id', team.id)

  // Get leader profile
  let leaderName = 'Team Leader'
  if (team.leader_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', team.leader_id)
      .maybeSingle()
    if (profile?.full_name) {
      leaderName = profile.full_name
    }
  }

  const eventData = team.events as unknown as {
    min_team_size?: number
    max_team_size?: number
  }

  return {
    success: true,
    team: {
      id: team.id,
      name: team.name,
      eventId: team.event_id,
      status: team.status,
      leaderName,
      memberCount: memberCount || 0,
      minTeamSize: eventData?.min_team_size || 2,
      maxTeamSize: eventData?.max_team_size || 4,
    },
  }
}

export async function getUserTeamForEvent(eventId: string): Promise<{
  success: boolean
  team?: EventRegistrationTeam | null
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: true, team: null }
  }

  const { data: membership } = await supabase
    .from('event_registration_team_members')
    .select('team_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership?.team_id) {
    return { success: true, team: null }
  }

  const { data: team, error: teamErr } = await supabase
    .from('event_registration_teams')
    .select('*')
    .eq('id', membership.team_id)
    .maybeSingle()

  if (teamErr || !team) {
    return { success: true, team: null }
  }

  // Get all members of this team
  const { data: members } = await supabase
    .from('event_registration_team_members')
    .select('id, team_id, user_id, event_id, role, status, joined_at')
    .eq('team_id', team.id)
    .order('joined_at', { ascending: true })

  // Fetch profiles for members
  const memberUserIds = (members || []).map((m) => m.user_id)
  let profilesMap = new Map<string, { id: string; display_name: string; avatar_url: string | null }>()

  if (memberUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', memberUserIds)

    if (profiles) {
      profilesMap = new Map(
        profiles.map((p) => [
          p.id,
          { id: p.id, display_name: p.full_name, avatar_url: p.avatar_url },
        ])
      )
    }
  }

  const enrichedMembers: EventRegistrationTeamMember[] = (members || []).map((m) => {
    const prof = profilesMap.get(m.user_id)
    return {
      id: m.id,
      team_id: m.team_id,
      user_id: m.user_id,
      event_id: m.event_id,
      role: m.role as 'leader' | 'member',
      status: m.status as 'pending' | 'confirmed',
      joined_at: m.joined_at,
      user: prof ? {
        id: prof.id,
        display_name: prof.display_name,
        avatar_url: prof.avatar_url,
      } : undefined,
    }
  })

  const leaderProf = profilesMap.get(team.leader_id)

  const resultTeam: EventRegistrationTeam = {
    id: team.id,
    event_id: team.event_id,
    name: team.name,
    leader_id: team.leader_id,
    invite_code: team.invite_code,
    status: team.status as 'forming' | 'complete' | 'disbanded',
    created_at: team.created_at,
    updated_at: team.updated_at,
    members: enrichedMembers,
    member_count: enrichedMembers.length,
    leader: leaderProf ? {
      id: leaderProf.id,
      display_name: leaderProf.display_name,
      avatar_url: leaderProf.avatar_url,
    } : undefined,
  }

  return { success: true, team: resultTeam }
}

async function createRegistrationTeamFallback(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  teamName: string,
  eventSlug?: string
): Promise<{
  success: boolean
  teamId?: string
  inviteCode?: string
  teamName?: string
  status?: string
  minTeamSize?: number
  maxTeamSize?: number
  error?: string
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in to create a team' }
  }

  const cleanedName = teamName.trim()
  if (cleanedName.length < 2 || cleanedName.length > 60) {
    return { success: false, error: 'Team name must be between 2 and 60 characters' }
  }

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, slug, status, capacity, active_registrations_count, registration_mode, min_team_size, max_team_size, max_teams, registration_deadline')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return { success: false, error: 'Event not found' }
  }

  if (event.status === 'cancelled') {
    return { success: false, error: 'This event has been cancelled' }
  }

  if (event.registration_mode === 'individual') {
    return { success: false, error: 'This event does not allow team registration' }
  }

  if (event.registration_deadline && new Date() > new Date(event.registration_deadline)) {
    return { success: false, error: 'Registration deadline has passed' }
  }

  // Check if user is already in a team for this event
  const { data: existingMember } = await supabase
    .from('event_registration_team_members')
    .select('id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existingMember) {
    return { success: false, error: 'You are already in a team for this event' }
  }

  const minTeamSize = event.min_team_size ?? 2
  const maxTeamSize = event.max_team_size ?? 4

  // Check team limit if max_teams is specified
  if (event.max_teams) {
    const { count: teamCount } = await supabase
      .from('event_registration_teams')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'disbanded')

    if ((teamCount ?? 0) >= event.max_teams) {
      return { success: false, error: 'Maximum number of teams reached for this event' }
    }
  }

  // Check capacity
  if (event.capacity !== null && event.capacity !== undefined) {
    const activeRegs = event.active_registrations_count ?? 0
    if (activeRegs + minTeamSize > event.capacity) {
      return { success: false, error: 'Not enough capacity remaining to form a new team' }
    }
  }

  // Check duplicate team name in event
  const { data: duplicateTeam } = await supabase
    .from('event_registration_teams')
    .select('id')
    .eq('event_id', eventId)
    .ilike('name', cleanedName)
    .neq('status', 'disbanded')
    .maybeSingle()

  if (duplicateTeam) {
    return { success: false, error: 'A team with this name already exists in this event' }
  }

  const inviteCode = crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  const initialStatus = minTeamSize <= 1 ? 'complete' : 'forming'
  const memberStatus = minTeamSize <= 1 ? 'confirmed' : 'pending'

  // Insert team
  const { data: team, error: teamError } = await supabase
    .from('event_registration_teams')
    .insert({
      event_id: eventId,
      name: cleanedName,
      leader_id: user.id,
      invite_code: inviteCode,
      status: initialStatus,
    })
    .select('id')
    .single()

  if (teamError || !team) {
    return { success: false, error: teamError?.message || 'Failed to create team' }
  }

  // Insert leader as member
  const { error: memberError } = await supabase
    .from('event_registration_team_members')
    .insert({
      team_id: team.id,
      user_id: user.id,
      event_id: eventId,
      role: 'leader',
      status: memberStatus,
    })

  if (memberError) {
    return { success: false, error: memberError.message }
  }

  if (eventSlug || event.slug) {
    revalidatePath(`/events/${eventSlug || event.slug}`)
  }

  return {
    success: true,
    teamId: team.id,
    inviteCode,
    teamName: cleanedName,
    status: initialStatus,
    minTeamSize,
    maxTeamSize,
  }
}

