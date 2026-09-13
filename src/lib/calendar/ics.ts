/**
 * RFC 5545 compliant iCalendar (.ics) generation & calendar interoperability utility.
 * Supports Google Calendar, Apple Calendar, Outlook, timezone correctness, and reschedule updates.
 */

export interface IcsEventOptions {
  id: string
  title: string
  description?: string | null
  location: string
  eventDate: string // YYYY-MM-DD
  startTime: string // HH:mm or HH:mm:ss
  endTime: string // HH:mm or HH:mm:ss
  startsAt?: string | null // ISO 8601 string
  endsAt?: string | null // ISO 8601 string
  timezone?: string | null
  organizerName?: string | null
  organizerEmail?: string | null
  url?: string | null
  sequence?: number | null // RFC 5545 update/reschedule version
  status?: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE' | null
  lastModified?: string | null
}

function escapeIcsText(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n')
}

/**
 * Formats a Date or ISO string into an RFC 5545 UTC timestamp: YYYYMMDDTHHmmssZ
 */
export function formatIcsUtc(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

/**
 * Fallback date formatter for legacy date + time strings without full ISO timestamps
 */
function formatIcsDateTime(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '')
  const cleanTime = timeStr.replace(/:/g, '').slice(0, 4) // HHmm
  return `${cleanDate}T${cleanTime}00`
}

/**
 * Generate RFC 5545 compliant .ics format with UID, SEQUENCE, and STATUS for seamless reschedules.
 */
export function generateEventIcs(event: IcsEventOptions): string {
  const dtStamp = formatIcsUtc(new Date())
  const uid = `${event.id}@campusloop.internal`
  const sequence = event.sequence ?? 0
  const status = event.status || 'CONFIRMED'

  let dtStart: string
  let dtEnd: string

  if (event.startsAt && !isNaN(new Date(event.startsAt).getTime())) {
    dtStart = `DTSTART:${formatIcsUtc(event.startsAt)}`
  } else if (event.timezone) {
    dtStart = `DTSTART;TZID=${event.timezone}:${formatIcsDateTime(event.eventDate, event.startTime)}`
  } else {
    dtStart = `DTSTART:${formatIcsDateTime(event.eventDate, event.startTime)}`
  }

  if (event.endsAt && !isNaN(new Date(event.endsAt).getTime())) {
    dtEnd = `DTEND:${formatIcsUtc(event.endsAt)}`
  } else if (event.timezone) {
    dtEnd = `DTEND;TZID=${event.timezone}:${formatIcsDateTime(event.eventDate, event.endTime)}`
  } else {
    dtEnd = `DTEND:${formatIcsDateTime(event.eventDate, event.endTime)}`
  }

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusLoop//EventHub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${status}`,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcsText(event.title)}`,
    `DESCRIPTION:${escapeIcsText(event.description || '')}`,
    `LOCATION:${escapeIcsText(event.location)}`,
  ]

  if (event.lastModified) {
    lines.push(`LAST-MODIFIED:${formatIcsUtc(event.lastModified)}`)
  }

  if (event.organizerName) {
    const orgEmail = event.organizerEmail || 'no-reply@campusloop.internal'
    lines.push(`ORGANIZER;CN=${escapeIcsText(event.organizerName)}:mailto:${orgEmail}`)
  }

  if (event.url) {
    lines.push(`URL:${event.url}`)
  }

  lines.push('END:VEVENT')
  lines.push('END:VCALENDAR')

  return lines.join('\r\n')
}

export function createIcsDataUrl(icsContent: string): string {
  const base64 = Buffer.from(icsContent, 'utf-8').toString('base64')
  return `data:text/calendar;charset=utf-8;base64,${base64}`
}

/**
 * Generate a direct web template URL for Google Calendar.
 */
export function createGoogleCalendarUrl(event: IcsEventOptions): string {
  let dates: string
  if (event.startsAt && event.endsAt) {
    dates = `${formatIcsUtc(event.startsAt)}/${formatIcsUtc(event.endsAt)}`
  } else {
    dates = `${formatIcsDateTime(event.eventDate, event.startTime)}/${formatIcsDateTime(event.eventDate, event.endTime)}`
  }

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates,
    details: `${event.description || ''}${event.url ? `\n\nEvent Link: ${event.url}` : ''}`,
    location: event.location,
  })

  if (event.timezone) {
    params.set('ctz', event.timezone)
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Generate a direct web template URL for Outlook.com / Office 365.
 */
export function createOutlookCalendarUrl(event: IcsEventOptions): string {
  const startDt = event.startsAt || `${event.eventDate}T${event.startTime}:00`
  const endDt = event.endsAt || `${event.eventDate}T${event.endTime}:00`

  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: new Date(startDt).toISOString(),
    enddt: new Date(endDt).toISOString(),
    body: `${event.description || ''}${event.url ? `\n\nEvent Link: ${event.url}` : ''}`,
    location: event.location,
  })

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

export interface IcsSeriesOptions {
  seriesId: string
  seriesTitle: string
  description?: string | null
  organizerName?: string | null
  organizerEmail?: string | null
  timezone?: string | null
  sessions: Array<{
    id: string
    title: string
    eventDate: string
    startTime: string
    endTime: string
    startsAt?: string | null
    endsAt?: string | null
    location: string
    description?: string | null
    sequence?: number | null
    status?: 'CONFIRMED' | 'CANCELLED' | null
  }>
}

export function generateSeriesIcs(series: IcsSeriesOptions): string {
  const dtStamp = formatIcsUtc(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CampusLoop//EventHub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(series.seriesTitle)}`,
  ]

  for (const session of series.sessions) {
    const uid = `${session.id}@campusloop.internal`
    const sequence = session.sequence ?? 0
    const status = session.status || 'CONFIRMED'

    let dtStart: string
    let dtEnd: string

    if (session.startsAt && !isNaN(new Date(session.startsAt).getTime())) {
      dtStart = `DTSTART:${formatIcsUtc(session.startsAt)}`
    } else if (series.timezone) {
      dtStart = `DTSTART;TZID=${series.timezone}:${formatIcsDateTime(session.eventDate, session.startTime)}`
    } else {
      dtStart = `DTSTART:${formatIcsDateTime(session.eventDate, session.startTime)}`
    }

    if (session.endsAt && !isNaN(new Date(session.endsAt).getTime())) {
      dtEnd = `DTEND:${formatIcsUtc(session.endsAt)}`
    } else if (series.timezone) {
      dtEnd = `DTEND;TZID=${series.timezone}:${formatIcsDateTime(session.eventDate, session.endTime)}`
    } else {
      dtEnd = `DTEND:${formatIcsDateTime(session.eventDate, session.endTime)}`
    }

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${uid}`)
    lines.push(`DTSTAMP:${dtStamp}`)
    lines.push(`SEQUENCE:${sequence}`)
    lines.push(`STATUS:${status}`)
    lines.push(dtStart)
    lines.push(dtEnd)
    lines.push(`SUMMARY:${escapeIcsText(session.title)}`)
    lines.push(`DESCRIPTION:${escapeIcsText(session.description || series.description || '')}`)
    lines.push(`LOCATION:${escapeIcsText(session.location)}`)

    if (series.organizerName) {
      const orgEmail = series.organizerEmail || 'no-reply@campusloop.internal'
      lines.push(`ORGANIZER;CN=${escapeIcsText(series.organizerName)}:mailto:${orgEmail}`)
    }

    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
