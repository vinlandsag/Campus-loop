import { z } from 'zod'
// no extra date-fns imports needed

export const eventSchema = z.object({
  title: z
    .string()
    .min(3, 'Title must be at least 3 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(2000, 'Description cannot exceed 2000 characters'),
  category: z.string().min(1, 'Category is required'),
  timezone: z.string().default('UTC').optional(),
  event_date: z.string().min(1, 'Event date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  location: z.string().min(1, 'Location is required').max(200, 'Location is too long'),
  capacity: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      return Number(val)
    })
    .refine((val) => val === null || val > 0, {
      message: 'Capacity must be greater than zero if specified',
    }),
  banner_url: z.string().url('Must be a valid URL').nullable().optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'cancelled']),
  is_paid: z.boolean().default(false),
  price: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      const num = Number(val)
      return isNaN(num) ? null : num
    })
    .optional(),
  eligibility: z.string().max(500).optional().nullable(),
  registration_deadline: z.string().optional().nullable(),
  what_to_bring: z.string().max(1000).optional().nullable(),
  contact_method: z.string().max(200).optional().nullable(),
  accessibility_notes: z.string().max(1000).optional().nullable(),
  map_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
  agenda: z
    .array(
      z.object({
        time: z.string(),
        title: z.string(),
        description: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
  speakers: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().optional(),
        bio: z.string().optional(),
        avatar_url: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
  // Phase 13: Team Registration & Recurrence
  registration_mode: z.enum(['individual', 'team', 'both']).default('individual'),
  min_team_size: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return 2
      const n = Number(val)
      return isNaN(n) ? 2 : n
    }),
  max_team_size: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return 4
      const n = Number(val)
      return isNaN(n) ? 4 : n
    }),
  max_teams: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }),
  is_recurring: z.boolean().default(false).optional(),
  recurrence_type: z.enum(['weekly', 'monthly', 'custom']).default('weekly').optional(),
  recurrence_interval: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => Math.max(1, Number(val) || 1)),
  recurrence_days: z.array(z.number()).optional(),
  recurrence_end_type: z.enum(['date', 'count']).default('count').optional(),
  recurrence_end_date: z.string().optional().nullable(),
  recurrence_count: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }),
  // Phase 15: Structured Venues & Maps
  venue_id: z.string().uuid().optional().nullable().or(z.literal('')),
  building: z.string().max(200).optional().nullable(),
  floor: z.string().max(50).optional().nullable(),
  room: z.string().max(100).optional().nullable(),
  latitude: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }),
  longitude: z
    .union([z.string(), z.number()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === '' || val === null || val === undefined) return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }),
  accessibility_details: z.string().max(1000).optional().nullable(),
  directions_url: z.string().url('Must be a valid URL').optional().nullable().or(z.literal('')),
}).refine(
  (data) => {
    if (data.is_paid) {
      return typeof data.price === 'number' && data.price > 0
    }
    return true
  },
  {
    message: 'Price must be greater than zero for paid events',
    path: ['price'],
  }
).refine(
  (data) => {
    if (!data.start_time || !data.end_time) return true
    return data.end_time > data.start_time
  },
  {
    message: 'End time must be after start time',
    path: ['end_time'],
  }
).refine(
  (data) => {
    if (data.registration_mode === 'team' || data.registration_mode === 'both') {
      const min = data.min_team_size ?? 2
      const max = data.max_team_size ?? 4
      return max >= min
    }
    return true
  },
  {
    message: 'Maximum team size must be greater than or equal to minimum team size',
    path: ['max_team_size'],
  }
)

export type EventFormData = z.infer<typeof eventSchema>
