export const APP_NAME = 'CampusLoop'
export const APP_DESCRIPTION =
  'Discover, register for, and organise campus events — all in one place.'
export const APP_URL = process.env['NEXT_PUBLIC_APP_URL'] ?? 'http://localhost:3000'

export const EVENT_CATEGORIES = [
  { value: 'Academic', label: 'Academic' },
  { value: 'Career', label: 'Career' },
  { value: 'Cultural', label: 'Cultural' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Hackathon', label: 'Hackathon' },
  { value: 'Social', label: 'Social' },
  { value: 'Sports', label: 'Sports' },
  { value: 'Startup', label: 'Startup' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Workshop', label: 'Workshop' },
  { value: 'Other', label: 'Other' },
] as const

export type EventCategory = (typeof EVENT_CATEGORIES)[number]['value']
export const DEFAULT_TIMEZONE = 'UTC'

export const USER_ROLES = ['student', 'organizer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const MAX_COVER_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const EVENTS_PER_PAGE = 12
export const PARTICIPANTS_PER_PAGE = 20

/** Public routes that do not require authentication */
export const PUBLIC_ROUTES = ['/', '/events', '/organizers', '/login', '/signup', '/api/auth/callback']

/** Routes that require the organizer role */
export const ORGANIZER_ROUTES = ['/organizer']
