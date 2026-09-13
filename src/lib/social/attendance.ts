import { createClient } from '@/lib/supabase/server'
import type { ConsentedFriendAttendance } from '@/types'

/**
 * Fetch consented mutual friends attending a specific event.
 * Enforces strict fail-closed privacy: only returns attendees who are mutual accepted friends
 * with both user-level and event-level opt-in consent.
 */
export async function getEventFriendAttendance(
  eventId: string
): Promise<ConsentedFriendAttendance> {
  const fallback: ConsentedFriendAttendance = { count: 0, friends: [] }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return fallback
    }

    const { data, error } = await supabase.rpc('get_event_friend_attendance', {
      p_event_id: eventId,
    })

    if (error || !data) {
      return fallback
    }

    const typedData = data as {
      count: number
      friends: Array<{ id: string; name: string; avatar_url?: string | null }>
    }

    return {
      count: typedData.count || 0,
      friends: Array.isArray(typedData.friends) ? typedData.friends : [],
    }
  } catch (err) {
    console.error(`Failed to fetch friend attendance for event ${eventId}:`, err)
    return fallback
  }
}

/**
 * Batch fetch friend attendance across multiple events.
 */
export async function getBatchEventsFriendAttendance(
  eventIds: string[]
): Promise<Record<string, ConsentedFriendAttendance>> {
  const result: Record<string, ConsentedFriendAttendance> = {}
  if (!eventIds || eventIds.length === 0) return result

  // Parallelize individual RPC calls safely
  const entries = await Promise.all(
    eventIds.map(async (id) => {
      const attendance = await getEventFriendAttendance(id)
      return [id, attendance] as const
    })
  )

  for (const [id, attendance] of entries) {
    result[id] = attendance
  }

  return result
}
