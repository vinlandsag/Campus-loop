import { DEFAULT_TIMEZONE } from '@/lib/constants'

/**
 * Parse a date and time string in a specific timezone into a JavaScript Date object.
 *
 * Handles both 'UTC' (common default) and any IANA timezone (e.g. 'America/New_York').
 * Normalizes HH:mm or HH:mm:ss strings.
 */
export function parseDateTimeInZone(
  dateStr: string,
  timeStr: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  const normTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr

  // Fast path for UTC
  if (!timezone || timezone.toUpperCase() === 'UTC') {
    return new Date(`${dateStr}T${normTime}Z`)
  }

  // Handle named IANA timezones (e.g. 'America/New_York', 'Asia/Kolkata')
  const dateParts = dateStr.split('-').map(Number)
  const timeParts = normTime.split(':').map(Number)

  const y = dateParts[0]
  const m = dateParts[1]
  const d = dateParts[2]
  const hh = timeParts[0]
  const mm = timeParts[1]
  const ss = timeParts[2] || 0

  if (y === undefined || m === undefined || d === undefined || hh === undefined || mm === undefined || isNaN(hh) || isNaN(mm)) {
    return new Date(`${dateStr}T${normTime}`)
  }

  const targetUtc = Date.UTC(y, m - 1, d, hh, mm, ss)

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    })

    const parts = formatter.formatToParts(new Date(targetUtc))
    const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)

    const hour = getPart('hour') === 24 ? 0 : getPart('hour')
    const inTzUtc = Date.UTC(
      getPart('year'),
      getPart('month') - 1,
      getPart('day'),
      hour,
      getPart('minute'),
      getPart('second')
    )

    const offset = inTzUtc - targetUtc
    return new Date(targetUtc - offset)
  } catch {
    // Fallback if timezone string is invalid
    return new Date(`${dateStr}T${normTime}Z`)
  }
}

/**
 * Get the exact end Date for an event.
 */
export function getEventEndDateTime(
  eventDate: string,
  endTime: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  return parseDateTimeInZone(eventDate, endTime, timezone)
}

/**
 * Get the exact start Date for an event.
 */
export function getEventStartDateTime(
  eventDate: string,
  startTime: string,
  timezone: string = DEFAULT_TIMEZONE
): Date {
  return parseDateTimeInZone(eventDate, startTime, timezone)
}

/**
 * Determine if an event has officially ended based on its date and end time.
 * Returns true ONLY if current time is strictly after the event's end time.
 */
export function isEventPast(
  event: { event_date: string; end_time: string; timezone?: string | null },
  referenceDate: Date = new Date()
): boolean {
  try {
    const endDate = getEventEndDateTime(
      event.event_date,
      event.end_time,
      event.timezone || DEFAULT_TIMEZONE
    )
    return referenceDate.getTime() > endDate.getTime()
  } catch {
    return false
  }
}

/**
 * Determine if an event is upcoming (not yet ended).
 */
export function isEventUpcoming(
  event: { event_date: string; end_time: string; timezone?: string | null },
  referenceDate: Date = new Date()
): boolean {
  return !isEventPast(event, referenceDate)
}
