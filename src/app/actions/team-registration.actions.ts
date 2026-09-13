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
