import { addDays, addMonths, parseISO, format, isBefore, isAfter, startOfDay } from 'date-fns'

export interface RecurrenceConfig {
  startDate: string // YYYY-MM-DD
  startTime: string // HH:mm
  endTime: string // HH:mm
  recurrenceType: 'weekly' | 'monthly' | 'custom'
  intervalValue?: number // default 1
  daysOfWeek?: number[] // 0 = Sun, 1 = Mon, ..., 6 = Sat
  endType: 'date' | 'count'
  endDate?: string // YYYY-MM-DD
  occurrenceCount?: number // e.g. 6
  seriesTitle: string
  seriesSlug: string
}

export interface GeneratedOccurrence {
  sequenceIndex: number
  title: string
  slug: string
  eventDate: string // YYYY-MM-DD
  startTime: string
  endTime: string
}

const MAX_OCCURRENCES_SAFEGUARD = 52

export function generateOccurrences(config: RecurrenceConfig): GeneratedOccurrence[] {
  const occurrences: GeneratedOccurrence[] = []
  const interval = Math.max(1, config.intervalValue || 1)
  const maxCount = config.endType === 'count' && config.occurrenceCount && config.occurrenceCount > 0
    ? Math.min(config.occurrenceCount, MAX_OCCURRENCES_SAFEGUARD)
    : MAX_OCCURRENCES_SAFEGUARD

  const startDateParsed = startOfDay(parseISO(config.startDate))
  const endDateParsed = config.endType === 'date' && config.endDate
    ? startOfDay(parseISO(config.endDate))
    : null

  let sequenceIndex = 1

  if (config.recurrenceType === 'weekly') {
    const days = config.daysOfWeek && config.daysOfWeek.length > 0
      ? [...config.daysOfWeek].sort((a, b) => a - b)
      : [startDateParsed.getDay()]

    let currentWeekStart = startDateParsed

    while (occurrences.length < maxCount) {
      for (const targetDay of days) {
        // Calculate offset to target day in current week
        const currentDay = currentWeekStart.getDay()
        let dayDiff = targetDay - currentDay
        if (dayDiff < 0) dayDiff += 7

        const candidateDate = addDays(currentWeekStart, dayDiff)

        // Only include if on or after startDate
        if (isBefore(candidateDate, startDateParsed)) {
          continue
        }

        // Stop if past end date
        if (endDateParsed && isAfter(candidateDate, endDateParsed)) {
          return occurrences
        }

        occurrences.push({
          sequenceIndex,
          title: `${config.seriesTitle} - Session ${sequenceIndex}`,
          slug: `${config.seriesSlug}-session-${sequenceIndex}`,
          eventDate: format(candidateDate, 'yyyy-MM-dd'),
          startTime: config.startTime,
          endTime: config.endTime,
        })

        sequenceIndex++
        if (occurrences.length >= maxCount) {
          return occurrences
        }
      }

      // Advance by interval weeks
      currentWeekStart = addDays(currentWeekStart, interval * 7)
    }
  } else if (config.recurrenceType === 'monthly') {
    let currentDate = startDateParsed

    while (occurrences.length < maxCount) {
      if (endDateParsed && isAfter(currentDate, endDateParsed)) {
        break
      }

      occurrences.push({
        sequenceIndex,
        title: `${config.seriesTitle} - Session ${sequenceIndex}`,
        slug: `${config.seriesSlug}-session-${sequenceIndex}`,
        eventDate: format(currentDate, 'yyyy-MM-dd'),
        startTime: config.startTime,
        endTime: config.endTime,
      })

      sequenceIndex++
      currentDate = addMonths(currentDate, interval)
    }
  } else {
    // Custom: repeats every interval days
    let currentDate = startDateParsed

    while (occurrences.length < maxCount) {
      if (endDateParsed && isAfter(currentDate, endDateParsed)) {
        break
      }

      occurrences.push({
        sequenceIndex,
        title: `${config.seriesTitle} - Session ${sequenceIndex}`,
        slug: `${config.seriesSlug}-session-${sequenceIndex}`,
        eventDate: format(currentDate, 'yyyy-MM-dd'),
        startTime: config.startTime,
        endTime: config.endTime,
      })

      sequenceIndex++
      currentDate = addDays(currentDate, interval)
    }
  }

  return occurrences
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function formatRecurrenceRule(config: {
  recurrenceType: 'weekly' | 'monthly' | 'custom'
  intervalValue?: number
  daysOfWeek?: number[] | null
  endType?: 'date' | 'count'
  endDate?: string | null
  occurrenceCount?: number | null
}): string {
  const interval = config.intervalValue || 1

  let frequencyStr = ''
  if (config.recurrenceType === 'weekly') {
    if (interval === 1) {
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        const days = config.daysOfWeek.map((d) => DAY_NAMES[d] || '').filter(Boolean)
        frequencyStr = `Weekly on ${days.join(', ')}`
      } else {
        frequencyStr = 'Weekly'
      }
    } else {
      if (config.daysOfWeek && config.daysOfWeek.length > 0) {
        const days = config.daysOfWeek.map((d) => DAY_NAMES[d] || '').filter(Boolean)
        frequencyStr = `Every ${interval} weeks on ${days.join(', ')}`
      } else {
        frequencyStr = `Every ${interval} weeks`
      }
    }
  } else if (config.recurrenceType === 'monthly') {
    frequencyStr = interval === 1 ? 'Monthly' : `Every ${interval} months`
  } else {
    frequencyStr = interval === 1 ? 'Daily' : `Every ${interval} days`
  }

  let durationStr = ''
  if (config.endType === 'count' && config.occurrenceCount) {
    durationStr = ` • ${config.occurrenceCount} sessions`
  } else if (config.endType === 'date' && config.endDate) {
    durationStr = ` • Until ${config.endDate}`
  }

  return `${frequencyStr}${durationStr}`
}

export function calculateSeriesProgress(
  occurrences: Array<{ event_date?: string; status?: string }>
): {
  total: number
  completed: number
  upcoming: number
  cancelled: number
  nextSessionIndex: number | null
} {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  let completed = 0
  let upcoming = 0
  let cancelled = 0
  let nextSessionIndex: number | null = null

  occurrences.forEach((occ, idx) => {
    if (occ.status === 'cancelled') {
      cancelled++
    } else if (occ.event_date && occ.event_date < todayStr) {
      completed++
    } else {
      upcoming++
      if (nextSessionIndex === null) {
        nextSessionIndex = idx + 1
      }
    }
  })

  return {
    total: occurrences.length,
    completed,
    upcoming,
    cancelled,
    nextSessionIndex,
  }
}
