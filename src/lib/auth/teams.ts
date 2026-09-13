import { createClient } from '@/lib/supabase/server'
import type { EventTeamRole } from '@/types'

/**
 * Resolve the user's role for a specific event.
 * Priority:
 * 1. Event creator / organizer_id -> 'owner'
 * 2. Scoped team membership in event_team_members table -> assigned role
 * 3. Otherwise -> null (no authorized access)
 */
export async function getEventUserRole(
  eventId: string,
  userId: string
): Promise<EventTeamRole | null> {
  if (!eventId || !userId) return null

  try {
    const supabase = await createClient()

    // 1. Check if user is the direct event creator
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', eventId)
      .maybeSingle()

    if (!eventErr && event && event.organizer_id === userId) {
      return 'owner'
    }

    // 2. Check event_team_members table
    const { data: teamMember, error: teamErr } = await supabase
      .from('event_team_members')
      .select('role')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!teamErr && teamMember?.role) {
      return teamMember.role as EventTeamRole
    }

    // 3. Fallback: check user metadata or organizer profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    if (profile?.role === 'organizer' && event?.organizer_id === userId) {
      return 'owner'
    }

    return null
  } catch (err) {
    console.warn('Error resolving event user role:', err)
    return null
  }
}

// Re-export pure permission predicates
export * from './permissions'
