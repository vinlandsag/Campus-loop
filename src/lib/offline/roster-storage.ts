import type { OfflineCheckInRoster } from '@/types'

const ROSTER_STORAGE_PREFIX = 'campusloop_roster_'
const QUEUE_STORAGE_PREFIX = 'campusloop_offline_queue_'
const CURRENT_VERSION = 1
export const DEFAULT_ROSTER_TTL_MS = 12 * 60 * 60 * 1000 // 12 hours

interface StoredRosterEnvelope {
  version: number
  eventId: string
  cachedAt: string
  expiresAt: string
  payload: string // Obfuscated Base64-encoded JSON payload for local minimization
}

/**
 * Simple client-side data obfuscation to prevent casual plain-text inspection of stored rosters.
 */
function obfuscate(jsonStr: string): string {
  if (typeof btoa === 'function') {
    return btoa(encodeURIComponent(jsonStr))
  }
  return Buffer.from(encodeURIComponent(jsonStr)).toString('base64')
}

function deobfuscate(base64Str: string): string {
  if (typeof atob === 'function') {
    return decodeURIComponent(atob(base64Str))
  }
  return decodeURIComponent(Buffer.from(base64Str, 'base64').toString('utf8'))
}

/**
 * Store offline check-in roster with expiry and security envelope.
 */
export function saveOfflineRoster(eventId: string, roster: OfflineCheckInRoster): void {
  if (typeof window === 'undefined') return

  try {
    const expiresAt = roster.expiresAt || new Date(Date.now() + DEFAULT_ROSTER_TTL_MS).toISOString()
    const envelope: StoredRosterEnvelope = {
      version: CURRENT_VERSION,
      eventId,
      cachedAt: roster.cachedAt || new Date().toISOString(),
      expiresAt,
      payload: obfuscate(JSON.stringify(roster.attendees)),
    }

    localStorage.setItem(`${ROSTER_STORAGE_PREFIX}${eventId}`, JSON.stringify(envelope))
  } catch (err) {
    console.error('Failed to securely store offline roster:', err)
  }
}

/**
 * Load offline check-in roster.
 * Fails closed and purges stale data if expired.
 */
export function loadOfflineRoster(eventId: string): {
  roster: OfflineCheckInRoster | null
  isExpired: boolean
  error?: string
} {
  if (typeof window === 'undefined') {
    return { roster: null, isExpired: false }
  }

  const storageKey = `${ROSTER_STORAGE_PREFIX}${eventId}`

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) {
      return { roster: null, isExpired: false }
    }

    let envelope: StoredRosterEnvelope
    try {
      envelope = JSON.parse(raw)
    } catch {
      // Malformed envelope: purge immediately
      localStorage.removeItem(storageKey)
      return { roster: null, isExpired: false }
    }

    // Check expiry lifecycle
    const expiryTime = new Date(envelope.expiresAt).getTime()
    if (isNaN(expiryTime) || Date.now() >= expiryTime) {
      // Purge expired data safely
      localStorage.removeItem(storageKey)
      return {
        roster: null,
        isExpired: true,
        error: 'Offline check-in roster has expired. Please re-download while online.',
      }
    }

    // De-obfuscate attendees
    const attendeesJson = deobfuscate(envelope.payload)
    const attendees = JSON.parse(attendeesJson)

    return {
      roster: {
        eventId: envelope.eventId,
        eventTitle: '',
        cachedAt: envelope.cachedAt,
        expiresAt: envelope.expiresAt,
        version: envelope.version,
        attendees,
      },
      isExpired: false,
    }
  } catch (err) {
    console.error('Error loading offline roster:', err)
    localStorage.removeItem(storageKey)
    return { roster: null, isExpired: false, error: 'Failed to decrypt offline roster.' }
  }
}

/**
 * Check whether a loaded roster is expired.
 */
export function isRosterExpired(roster: OfflineCheckInRoster | null | undefined): boolean {
  if (!roster || !roster.expiresAt) return false
  const expTime = new Date(roster.expiresAt).getTime()
  return !isNaN(expTime) && Date.now() >= expTime
}

/**
 * Remove a single event's offline cached roster.
 */
export function clearOfflineRoster(eventId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(`${ROSTER_STORAGE_PREFIX}${eventId}`)
  } catch (err) {
    console.error('Failed to clear offline roster:', err)
  }
}

/**
 * Purge ALL cached rosters and pending offline check-in queues.
 * Invoked on logout, user switch, or security clear.
 */
export function clearAllOfflineRosters(): void {
  if (typeof window === 'undefined') return

  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith(ROSTER_STORAGE_PREFIX) || key.startsWith(QUEUE_STORAGE_PREFIX))) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      localStorage.removeItem(key)
    }
  } catch (err) {
    console.error('Failed to clear all offline rosters:', err)
  }
}
