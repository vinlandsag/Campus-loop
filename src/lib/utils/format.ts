/**
 * Format a date for display.
 * All dates are stored in UTC; this formats in the user's local timezone.
 */

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options,
  }).format(d)
}

export function formatDateShort(date: Date | string): string {
  return formatDate(date, { month: 'short', day: 'numeric', year: undefined })
}

export function formatDateTime(date: Date | string): string {
  return formatDate(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function formatDateRange(start: Date | string, end: Date | string): string {
  const s = typeof start === 'string' ? new Date(start) : start
  const e = typeof end === 'string' ? new Date(end) : end
  const sameDay = s.toDateString() === e.toDateString()
  if (sameDay) {
    return `${formatDate(s)} · ${formatTime(s)} – ${formatTime(e)}`
  }
  return `${formatDate(s)} – ${formatDate(e)}`
}

export function isUpcoming(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date
  return d > new Date()
}

export function isPast(date: Date | string): boolean {
  return !isUpcoming(date)
}

/**
 * Format a number as a compact string (e.g. 1500 → "1.5K")
 */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(n)
}
