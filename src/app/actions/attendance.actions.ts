'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { notificationService } from '@/lib/notifications/service'
import { getEventUserRole, canCheckIn } from '@/lib/auth/teams'
import { verifyTicketCodeSignature } from '@/lib/tickets/service'
import { checkDurableRateLimit } from '@/lib/rate-limit/durable-limiter'
import type {
  CheckInResult,
  AttendanceStats,
  ActionResult,
  OfflineCheckInRoster,
  QueuedOfflineScan,
  OfflineSyncResult,
} from '@/types'

/**
 * Check-in an attendee by ticket code.
 * Idempotent: Scanning the same ticket twice reports alreadyCheckedIn: true.
 * Cross-event check: Prevents tickets from one event being used on another.
 */
export async function checkInAttendee(
  eventId: string,
  rawTicketCode: string
): Promise<CheckInResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'You must be logged in as an organizer to check in attendees.' }
  }

  const ticketCode = rawTicketCode.trim().toUpperCase()
  if (!ticketCode) {
    return { success: false, error: 'Please enter or scan a ticket code.' }
  }

  // 1. Verify caller owns this event or has check-in team permission
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug, organizer_id')
    .eq('id', eventId)
    .single()

  if (eventErr || !event) {
    return { success: false, error: 'Event not found.' }
  }

  const userRole = await getEventUserRole(eventId, user.id)
  if (!canCheckIn(userRole)) {
    return { success: false, error: 'You do not have permission to check in attendees for this event.' }
  }

  // Rate limit check-in attempts (max 60 per minute per staff member to prevent brute force)
  const rateLimit = await checkDurableRateLimit(supabase, {
    key: user.id,
    action: 'check_in_ticket',
    maxRequests: 60,
    windowSeconds: 60,
  })

  if (!rateLimit.allowed) {
    return {
      success: false,
      error: 'Too many check-in attempts. Please wait a moment before trying again.',
    }
  }

  // Extract regId chunk if code matches format CL-[SLUG]-[REGID]-[SIG]
  const parts = ticketCode.split('-')
  const regIdChunk = parts.length >= 3 && parts[2] ? parts[2].toLowerCase() : null

  // 2. Check if this ticket belongs to a registration for THIS event
  const regQuery = supabase
    .from('registrations')
    .select('id, user_id, event_id, status, registered_at, ticket_code')
    .eq('event_id', eventId)

  // Try checking ticket_code column first
  const { data: directMatch } = await regQuery.eq('ticket_code', ticketCode).maybeSingle()

  let registration = directMatch

  // If no direct ticket_code match, try matching by registration ID prefix ONLY if signature is valid
  if (!registration && regIdChunk && regIdChunk.length >= 6) {
    const { data: prefixMatches } = await supabase
      .from('registrations')
      .select('id, user_id, event_id, status, registered_at, ticket_code')
      .eq('event_id', eventId)

    if (prefixMatches) {
      const candidate = prefixMatches.find(
        (r) => r.id.replace(/-/g, '').toLowerCase().startsWith(regIdChunk)
      )
      if (candidate) {
        const isValidSignature = verifyTicketCodeSignature(
          ticketCode,
          eventId,
          candidate.user_id,
          candidate.id
        )
        if (isValidSignature) {
          registration = candidate
        }
      }
    }
  }

  // 3. If still not found for THIS event, check if it belongs to ANOTHER event
  if (!registration) {
    const { data: otherEventReg } = await supabase
      .from('registrations')
      .select('id, event_id, events(title)')
      .eq('ticket_code', ticketCode)
      .maybeSingle()

    if (otherEventReg) {
      const otherTitle = (otherEventReg.events as unknown as { title?: string })?.title || 'another event'
      return {
        success: false,
        error: `This ticket belongs to a different event: "${otherTitle}". It cannot be used here.`,
      }
    }

    return {
      success: false,
      error: 'Invalid or unrecognized ticket code. Make sure the attendee has a valid registration.',
    }
  }

  // 4. Check registration status
  if (registration.status === 'cancelled') {
    return {
      success: false,
      error: 'This registration was cancelled by the attendee. Admission denied.',
    }
  }

  if (registration.status === 'waitlisted') {
    return {
      success: false,
      error: 'Attendee is currently on the waitlist and has not been admitted yet.',
    }
  }

  // 5. Fetch attendee profile for display name
  const { data: attendeeProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', registration.user_id)
    .maybeSingle()

  const attendeeName = attendeeProfile?.full_name || 'Attendee'

  // 6. Check if already checked in (Idempotency)
  // Check checked_in_at column or metadata
  const { data: fullReg } = await supabase
    .from('registrations')
    .select('*')
    .eq('id', registration.id)
    .single()

  const alreadyCheckedIn =
    Boolean(fullReg?.checked_in_at) ||
    fullReg?.status === 'checked_in'

  if (alreadyCheckedIn) {
    return {
      success: true,
      alreadyCheckedIn: true,
      checkedInAt: fullReg?.checked_in_at || new Date().toISOString(),
      attendeeName,
      ticketCode,
      eventTitle: event.title,
    }
  }

  // 7. Record check-in
  const now = new Date().toISOString()

  // Attempt update with status: 'checked_in' and checked_in_at
  const { error: updateErr } = await supabase
    .from('registrations')
    .update({
      checked_in_at: now,
      checked_in_by: user.id,
      status: 'checked_in',
    } as unknown as Record<string, unknown>)
    .eq('id', registration.id)

  if (updateErr) {
    // If enum value 'checked_in' is not yet present on remote DB, update without status or with checked_in_at
    console.warn('Check-in status update fallback:', updateErr.message)
    await supabase
      .from('registrations')
      .update({
        checked_in_at: now,
        checked_in_by: user.id,
      } as unknown as Record<string, unknown>)
      .eq('id', registration.id)
  }

  // 8. Send notification to attendee
  try {
    await notificationService.send({
      userId: registration.user_id,
      eventId: event.id,
      type: 'checked_in',
      title: 'Checked In!',
      message: `You've been successfully checked in to "${event.title}". Enjoy!`,
      link: `/events/${event.slug}`,
    })
  } catch (err) {
    console.error('Failed to dispatch checked-in notification:', err)
  }

  revalidatePath(`/dashboard/events/${eventId}/participants`)
  revalidatePath(`/dashboard/events/${eventId}/check-in`)
  revalidatePath(`/events/${event.slug}`)

  return {
    success: true,
    alreadyCheckedIn: false,
    checkedInAt: now,
    attendeeName,
    ticketCode,
    eventTitle: event.title,
  }
}

/**
 * Manually check in an attendee from the participants list.
 */
export async function manualCheckInAttendee(
  eventId: string,
  registrationId: string
): Promise<CheckInResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Unauthorized' }
  }

  const userRole = await getEventUserRole(eventId, user.id)
  if (!canCheckIn(userRole)) {
    return { success: false, error: 'You do not have permission to check in attendees for this event.' }
  }

  const { data: reg, error: regErr } = await supabase
    .from('registrations')
    .select('*, profiles(full_name), events(id, title, slug, organizer_id)')
    .eq('id', registrationId)
    .single()

  if (regErr || !reg) {
    return { success: false, error: 'Registration not found.' }
  }

  const regData = reg as unknown as {
    id: string
    event_id: string
    user_id: string
    status: string
    checked_in_at: string | null
    ticket_code: string | null
    profiles?: { full_name?: string }
    events?: { id: string; title: string; slug: string; organizer_id: string }
  }

  if (regData.event_id !== eventId) {
    return { success: false, error: 'Registration does not match this event.' }
  }

  const attendeeName = regData.profiles?.full_name || 'Attendee'
  const eventTitle = regData.events?.title || 'Event'

  if (regData.status === 'cancelled') {
    return { success: false, error: 'This registration was cancelled.' }
  }

  if (regData.status === 'waitlisted') {
    return { success: false, error: 'Cannot check in an attendee who is still on the waitlist.' }
  }

  if (regData.checked_in_at || regData.status === 'checked_in') {
    return {
      success: true,
      alreadyCheckedIn: true,
      checkedInAt: regData.checked_in_at || new Date().toISOString(),
      attendeeName,
      ticketCode: regData.ticket_code || undefined,
      eventTitle,
    }
  }

  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from('registrations')
    .update({
      checked_in_at: now,
      checked_in_by: user.id,
      status: 'checked_in',
    } as unknown as Record<string, unknown>)
    .eq('id', registrationId)

  if (updateErr) {
    await supabase
      .from('registrations')
      .update({
        checked_in_at: now,
        checked_in_by: user.id,
      } as unknown as Record<string, unknown>)
      .eq('id', registrationId)
  }

  try {
    if (regData.events) {
      await notificationService.send({
        userId: regData.user_id,
        eventId: regData.events.id,
        type: 'checked_in',
        title: 'Checked In!',
        message: `You've been successfully checked in to "${eventTitle}". Enjoy!`,
        link: `/events/${regData.events.slug}`,
      })
    }
  } catch (err) {
    console.error('Failed to notify on manual check-in:', err)
  }

  revalidatePath(`/dashboard/events/${eventId}/participants`)
  revalidatePath(`/dashboard/events/${eventId}/check-in`)
  if (regData.events?.slug) {
    revalidatePath(`/events/${regData.events.slug}`)
  }

  return {
    success: true,
    alreadyCheckedIn: false,
    checkedInAt: now,
    attendeeName,
    ticketCode: regData.ticket_code || undefined,
    eventTitle,
  }
}

/**
 * Fetch live attendance and waitlist statistics for an event.
 */
export async function getEventAttendanceStats(eventId: string): Promise<AttendanceStats> {
  const supabase = await createClient()

  // Get event capacity
  const { data: event } = await supabase
    .from('events')
    .select('capacity')
    .eq('id', eventId)
    .single()

  const capacity = event?.capacity ?? null

  // Fetch all registrations for this event
  const { data: registrations } = await supabase
    .from('registrations')
    .select('id, status, checked_in_at')
    .eq('event_id', eventId)

  const regs = (registrations || []) as Array<{
    id: string
    status: string
    checked_in_at?: string | null
  }>

  const registeredCount = regs.filter(
    (r) => r.status === 'registered' || r.status === 'checked_in'
  ).length

  const waitlistCount = regs.filter((r) => r.status === 'waitlisted').length

  const checkedInCount = regs.filter(
    (r) => r.status === 'checked_in' || Boolean(r.checked_in_at)
  ).length

  const attendanceRate =
    registeredCount > 0 ? Math.round((checkedInCount / registeredCount) * 100) : 0

  return {
    registeredCount,
    waitlistCount,
    checkedInCount,
    capacity,
    attendanceRate,
  }
}

/**
 * Fetch attendee roster for offline check-in caching.
 * Only authorized check-in staff, editor, or owner can download.
 */
export async function getOfflineCheckInRoster(
  eventId: string
): Promise<ActionResult<OfflineCheckInRoster>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const userRole = await getEventUserRole(eventId, user.id)
  if (!canCheckIn(userRole)) {
    return { success: false, error: 'You are not authorized to check in attendees for this event.' }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (!event) {
    return { success: false, error: 'Event not found' }
  }

  const { data: registrations, error } = await supabase
    .from('registrations')
    .select(`
      id,
      ticket_code,
      status,
      checked_in_at,
      user_id,
      profiles:user_id (display_name, full_name)
    `)
    .eq('event_id', eventId)
    .in('status', ['registered', 'checked_in'])

  if (error) {
    return { success: false, error: error.message }
  }

  const attendees = (registrations || []).map((r) => {
    const profile = r.profiles as unknown as { display_name?: string; full_name?: string } | null
    const attendeeName = profile?.display_name || profile?.full_name || 'Attendee'
    return {
      registrationId: r.id,
      ticketCode: r.ticket_code || '',
      attendeeName,
      status: r.status,
      checkedInAt: r.checked_in_at,
    }
  })

  return {
    success: true,
    data: {
      eventId: event.id,
      eventTitle: event.title,
      cachedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      attendees,
    },
  }
}

/**
 * Idempotently sync a batch of queued offline check-in scans.
 */
export async function syncOfflineCheckIns(
  eventId: string,
  scans: QueuedOfflineScan[]
): Promise<ActionResult<OfflineSyncResult[]>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const userRole = await getEventUserRole(eventId, user.id)
  if (!canCheckIn(userRole)) {
    return { success: false, error: 'You are not authorized to check in attendees for this event.' }
  }

  if (!scans || scans.length === 0) {
    return { success: true, data: [] }
  }

  const results: OfflineSyncResult[] = []

  for (const scan of scans) {
    const cleanCode = scan.ticketCode.trim().toUpperCase()

    // Find registration for this event by ticket_code
    const { data: reg } = await supabase
      .from('registrations')
      .select('id, user_id, status, checked_in_at, profiles:user_id(display_name, full_name)')
      .eq('event_id', eventId)
      .eq('ticket_code', cleanCode)
      .maybeSingle()

    if (!reg) {
      results.push({
        scanId: scan.scanId,
        ticketCode: cleanCode,
        success: false,
        error: 'Ticket not found for this event',
      })
      continue
    }

    const profile = reg.profiles as unknown as { display_name?: string; full_name?: string } | null
    const attendeeName = scan.attendeeName || profile?.display_name || profile?.full_name || 'Attendee'

    if (reg.status === 'cancelled') {
      results.push({
        scanId: scan.scanId,
        ticketCode: cleanCode,
        success: false,
        error: 'Registration was cancelled',
      })
      continue
    }

    const alreadyCheckedIn = Boolean(reg.checked_in_at) || reg.status === 'checked_in'

    if (alreadyCheckedIn) {
      results.push({
        scanId: scan.scanId,
        ticketCode: cleanCode,
        success: true,
        alreadyCheckedIn: true,
        attendeeName,
      })
      continue
    }

    // Record check-in
    const checkInTime = scan.scannedAt || new Date().toISOString()
    const { error: updateErr } = await supabase
      .from('registrations')
      .update({
        status: 'checked_in',
        checked_in_at: checkInTime,
        checked_in_by: user.id,
      } as unknown as Record<string, unknown>)
      .eq('id', reg.id)

    if (updateErr) {
      // Fallback
      await supabase
        .from('registrations')
        .update({
          checked_in_at: checkInTime,
          checked_in_by: user.id,
        } as unknown as Record<string, unknown>)
        .eq('id', reg.id)
    }

    results.push({
      scanId: scan.scanId,
      ticketCode: cleanCode,
      success: true,
      alreadyCheckedIn: false,
      attendeeName,
    })
  }

  revalidatePath(`/dashboard/events/${eventId}/check-in`)
  revalidatePath(`/dashboard/events/${eventId}/participants`)

  return { success: true, data: results }
}
