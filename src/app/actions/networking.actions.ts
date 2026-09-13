'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { UserNetworkingCard } from '@/types'

// Approved fields schema validation helper
function sanitizeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null
  const trimmed = url.trim()
  if (!trimmed) return null
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) {
    return `https://${trimmed}`
  }
  return trimmed
}

export async function getUserNetworkingCard(): Promise<{
  success: boolean
  data?: UserNetworkingCard | null
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('user_networking_cards')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching networking card:', error)
      return { success: false, error: error.message }
    }

    if (!data) {
      // Fallback: create default from user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      return {
        success: true,
        data: {
          user_id: user.id,
          full_name: profile?.full_name || 'Student',
          course_or_major: null,
          headline: null,
          interests: [],
          linkedin_url: null,
          portfolio_url: null,
          github_url: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }
    }

    return { success: true, data: data as UserNetworkingCard }
  } catch (err) {
    console.error('getUserNetworkingCard failure:', err)
    return { success: false, error: 'Failed to load networking card' }
  }
}

export async function upsertUserNetworkingCard(input: {
  full_name: string
  course_or_major?: string | null
  headline?: string | null
  interests?: string[] | null
  linkedin_url?: string | null
  portfolio_url?: string | null
  github_url?: string | null
}): Promise<{ success: boolean; data?: UserNetworkingCard; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    if (!input.full_name || input.full_name.trim().length === 0) {
      return { success: false, error: 'Name is required' }
    }

    // Only approved fields are persisted
    const cleanInterests = Array.isArray(input.interests)
      ? input.interests.map((i) => i.trim()).filter((i) => i.length > 0).slice(0, 10)
      : []

    const payload = {
      user_id: user.id,
      full_name: input.full_name.trim().slice(0, 100),
      course_or_major: input.course_or_major?.trim().slice(0, 100) || null,
      headline: input.headline?.trim().slice(0, 150) || null,
      interests: cleanInterests,
      linkedin_url: sanitizeUrl(input.linkedin_url),
      portfolio_url: sanitizeUrl(input.portfolio_url),
      github_url: sanitizeUrl(input.github_url),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('user_networking_cards')
      .upsert(payload, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('Error upserting networking card:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data: data as UserNetworkingCard }
  } catch (err) {
    console.error('upsertUserNetworkingCard failure:', err)
    return { success: false, error: 'Failed to update networking card' }
  }
}

export async function setEventNetworkingOptIn(
  eventId: string,
  isOptedIn: boolean
): Promise<{ success: boolean; exchangeToken?: string; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    const { data, error } = await supabase
      .from('event_networking_attendees')
      .upsert(
        {
          event_id: eventId,
          user_id: user.id,
          is_opted_in: isOptedIn,
        },
        { onConflict: 'event_id,user_id' }
      )
      .select('exchange_token')
      .single()

    if (error) {
      console.error('Error setting networking opt-in:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/events/[slug]/networking`, 'page')
    return { success: true, exchangeToken: data.exchange_token }
  } catch (err) {
    console.error('setEventNetworkingOptIn failure:', err)
    return { success: false, error: 'Failed to update networking preference' }
  }
}

export async function requestContactExchange(
  eventId: string,
  targetTokenOrUserId: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Resolve target user ID
    let targetUserId = targetTokenOrUserId
    if (targetTokenOrUserId.length === 32 || !targetTokenOrUserId.includes('-')) {
      const { data: attendee } = await supabase
        .from('event_networking_attendees')
        .select('user_id')
        .eq('event_id', eventId)
        .eq('exchange_token', targetTokenOrUserId)
        .eq('is_opted_in', true)
        .maybeSingle()

      if (!attendee) {
        return { success: false, error: 'Invalid or expired networking QR code / token' }
      }
      targetUserId = attendee.user_id
    }

    if (targetUserId === user.id) {
      return { success: false, error: 'You cannot connect with your own card' }
    }

    // Check if blocked
    const { data: block } = await supabase
      .from('networking_blocks')
      .select('blocker_id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`)
      .maybeSingle()

    if (block) {
      return { success: false, error: 'Unable to connect with this user' }
    }

    // Insert pending request
    const { error } = await supabase
      .from('contact_exchange_requests')
      .insert({
        event_id: eventId,
        requester_id: user.id,
        recipient_id: targetUserId,
        status: 'pending',
      })

    if (error) {
      if (error.code === '23505') {
        return { success: true, message: 'Exchange request has already been sent' }
      }
      console.error('Error creating contact request:', error)
      return { success: false, error: error.message }
    }

    revalidatePath(`/events/[slug]/networking`, 'page')
    return { success: true, message: 'Contact exchange request sent! Awaiting their confirmation.' }
  } catch (err) {
    console.error('requestContactExchange failure:', err)
    return { success: false, error: 'Failed to request contact exchange' }
  }
}

export async function respondToContactExchange(
  requestId: string,
  action: 'accept' | 'decline' | 'block'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Fetch request
    const { data: req, error: fetchErr } = await supabase
      .from('contact_exchange_requests')
      .select('id, requester_id, recipient_id, event_id')
      .eq('id', requestId)
      .single()

    if (fetchErr || !req) {
      return { success: false, error: 'Request not found' }
    }

    if (req.recipient_id !== user.id && req.requester_id !== user.id) {
      return { success: false, error: 'Unauthorized to respond to this request' }
    }

    const otherUserId = req.recipient_id === user.id ? req.requester_id : req.recipient_id

    if (action === 'block') {
      // Add to blocks and mark request blocked
      await supabase.from('networking_blocks').upsert({
        blocker_id: user.id,
        blocked_id: otherUserId,
      })

      await supabase
        .from('contact_exchange_requests')
        .update({ status: 'blocked', updated_at: new Date().toISOString() })
        .eq('id', requestId)
    } else {
      const newStatus = action === 'accept' ? 'accepted' : 'declined'
      const { error: updateErr } = await supabase
        .from('contact_exchange_requests')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', requestId)

      if (updateErr) {
        return { success: false, error: updateErr.message }
      }
    }

    revalidatePath(`/events/[slug]/networking`, 'page')
    return { success: true }
  } catch (err) {
    console.error('respondToContactExchange failure:', err)
    return { success: false, error: 'Failed to respond to request' }
  }
}

export async function blockNetworkingUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    await supabase.from('networking_blocks').upsert({
      blocker_id: user.id,
      blocked_id: targetUserId,
    })

    // Update any exchange requests
    await supabase
      .from('contact_exchange_requests')
      .update({ status: 'blocked', updated_at: new Date().toISOString() })
      .or(`and(requester_id.eq.${user.id},recipient_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},recipient_id.eq.${user.id})`)

    revalidatePath(`/events/[slug]/networking`, 'page')
    return { success: true }
  } catch (err) {
    console.error('blockNetworkingUser failure:', err)
    return { success: false, error: 'Failed to block user' }
  }
}

export async function getEventNetworkingData(eventId: string): Promise<{
  success: boolean
  isOptedIn?: boolean
  exchangeToken?: string
  myCard?: UserNetworkingCard | null
  incomingRequests?: Array<{
    id: string
    requesterId: string
    name: string
    headline?: string | null
    course?: string | null
    createdAt: string
  }>
  outgoingRequests?: Array<{
    id: string
    recipientId: string
    status: string
    createdAt: string
  }>
  connectedCards?: UserNetworkingCard[]
  directory?: Array<{
    userId: string
    fullName: string
    headline?: string | null
    course?: string | null
    exchangeToken: string
    hasPendingRequest: boolean
    isConnected: boolean
  }>
  error?: string
}> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // 1. Fetch user's own card
    const { data: myCard } = await supabase
      .from('user_networking_cards')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // 2. Fetch opt-in record
    const { data: optInRecord } = await supabase
      .from('event_networking_attendees')
      .select('is_opted_in, exchange_token')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle()

    const isOptedIn = optInRecord?.is_opted_in ?? false
    const exchangeToken = optInRecord?.exchange_token ?? ''

    // 3. Fetch blocks
    const { data: blocks } = await supabase
      .from('networking_blocks')
      .select('blocker_id, blocked_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`)

    const blockedIds = new Set<string>()
    blocks?.forEach((b) => {
      blockedIds.add(b.blocker_id === user.id ? b.blocked_id : b.blocker_id)
    })

    // 4. Fetch exchange requests
    const { data: requests } = await supabase
      .from('contact_exchange_requests')
      .select('*')
      .eq('event_id', eventId)
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)

    const connectedUserIds: string[] = []
    const pendingOutgoingIds = new Set<string>()
    const incomingList: Array<{
      id: string
      requesterId: string
      name: string
      headline?: string | null
      course?: string | null
      createdAt: string
    }> = []
    const outgoingList: Array<{
      id: string
      recipientId: string
      status: string
      createdAt: string
    }> = []

    // Collect IDs to preview for incoming requests
    const requesterIdsToFetch: string[] = []

    requests?.forEach((r) => {
      if (r.status === 'accepted') {
        const partnerId = r.requester_id === user.id ? r.recipient_id : r.requester_id
        if (!blockedIds.has(partnerId)) {
          connectedUserIds.push(partnerId)
        }
      } else if (r.status === 'pending') {
        if (r.recipient_id === user.id && !blockedIds.has(r.requester_id)) {
          requesterIdsToFetch.push(r.requester_id)
        } else if (r.requester_id === user.id && !blockedIds.has(r.recipient_id)) {
          pendingOutgoingIds.add(r.recipient_id)
          outgoingList.push({
            id: r.id,
            recipientId: r.recipient_id,
            status: r.status,
            createdAt: r.created_at,
          })
        }
      }
    })

    // Fetch minimal details for incoming request cards (for consent prompt: name/headline only)
    if (requesterIdsToFetch.length > 0) {
      const { data: requesterCards } = await supabase
        .from('user_networking_cards')
        .select('user_id, full_name, headline, course_or_major')
        .in('user_id', requesterIdsToFetch)

      const cardMap = new Map(requesterCards?.map((c) => [c.user_id, c]) || [])

      requests?.forEach((r) => {
        if (r.recipient_id === user.id && r.status === 'pending' && !blockedIds.has(r.requester_id)) {
          const card = cardMap.get(r.requester_id)
          incomingList.push({
            id: r.id,
            requesterId: r.requester_id,
            name: card?.full_name || 'Attendee',
            headline: card?.headline || null,
            course: card?.course_or_major || null,
            createdAt: r.created_at,
          })
        }
      })
    }

    // 5. Fetch full revealed cards for accepted connections
    let connectedCards: UserNetworkingCard[] = []
    if (connectedUserIds.length > 0) {
      const { data: cards } = await supabase
        .from('user_networking_cards')
        .select('*')
        .in('user_id', connectedUserIds)

      connectedCards = (cards || []) as UserNetworkingCard[]
    }

    // 6. Fetch directory of opted-in attendees
    const { data: attendees } = await supabase
      .from('event_networking_attendees')
      .select('user_id, exchange_token')
      .eq('event_id', eventId)
      .eq('is_opted_in', true)
      .neq('user_id', user.id)

    const attendeeUserIds = (attendees || [])
      .map((a) => a.user_id)
      .filter((id) => !blockedIds.has(id))

    let directory: Array<{
      userId: string
      fullName: string
      headline?: string | null
      course?: string | null
      exchangeToken: string
      hasPendingRequest: boolean
      isConnected: boolean
    }> = []

    if (attendeeUserIds.length > 0) {
      const { data: dirCards } = await supabase
        .from('user_networking_cards')
        .select('user_id, full_name, headline, course_or_major')
        .in('user_id', attendeeUserIds)

      const dirMap = new Map(dirCards?.map((c) => [c.user_id, c]) || [])
      const tokenMap = new Map(attendees?.map((a) => [a.user_id, a.exchange_token]) || [])
      const connectedSet = new Set(connectedUserIds)

      directory = attendeeUserIds.map((uid) => {
        const card = dirMap.get(uid)
        return {
          userId: uid,
          fullName: card?.full_name || 'Campus Attendee',
          headline: card?.headline || null,
          course: card?.course_or_major || null,
          exchangeToken: tokenMap.get(uid) || '',
          hasPendingRequest: pendingOutgoingIds.has(uid),
          isConnected: connectedSet.has(uid),
        }
      })
    }

    return {
      success: true,
      isOptedIn,
      exchangeToken,
      myCard: (myCard as UserNetworkingCard) || null,
      incomingRequests: incomingList,
      outgoingRequests: outgoingList,
      connectedCards,
      directory,
    }
  } catch (err) {
    console.error('getEventNetworkingData failure:', err)
    return { success: false, error: 'Failed to load networking data' }
  }
}
