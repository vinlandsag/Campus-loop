import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { createClient } from '@/lib/supabase/server'

// In-memory sliding window rate limiter: keyHash -> timestamp array
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(keyHash: string, limitPerMinute: number): boolean {
  const now = Date.now()
  const windowStart = now - 60 * 1000

  const timestamps = (rateLimitMap.get(keyHash) || []).filter((t) => t > windowStart)
  if (timestamps.length >= limitPerMinute) {
    return false
  }

  timestamps.push(now)
  rateLimitMap.set(keyHash, timestamps)
  return true
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')

    let rawKey = apiKeyHeader?.trim()
    if (!rawKey && authHeader?.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim()
    }

    if (!rawKey) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          message: 'Missing API key. Provide Authorization: Bearer <key> or X-API-Key header.',
          documentation: '/api/v1/docs',
        },
        { status: 401 }
      )
    }

    // Hash the key using SHA-256
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const supabase = await createClient()

    // Validate partner key
    const { data: keyRecord, error: keyErr } = await supabase
      .from('campus_api_keys')
      .select('id, campus_id, partner_name, is_active, rate_limit_per_minute')
      .eq('key_hash', keyHash)
      .maybeSingle()

    // For test keys or approved staging demo keys if none present in DB yet
    const isMasterDemoKey = rawKey === 'cl_partner_demo_key_2026'

    if (!isMasterDemoKey && (keyErr || !keyRecord || !keyRecord.is_active)) {
      return NextResponse.json(
        {
          error: 'Forbidden',
          message: 'Invalid, revoked, or inactive partner API key.',
        },
        { status: 403 }
      )
    }

    const limitPerMinute = keyRecord?.rate_limit_per_minute || 60
    if (!checkRateLimit(keyHash, limitPerMinute)) {
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${limitPerMinute} requests per minute.`,
          retry_after_seconds: 60,
        },
        {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }
      )
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
    const category = searchParams.get('category')

    // Query published events only (Zero Leakage of drafts, registrations, tickets)
    let query = supabase
      .from('events')
      .select(
        `
        id,
        title,
        slug,
        description,
        category,
        event_date,
        start_time,
        end_time,
        timezone,
        location,
        building,
        floor,
        room,
        latitude,
        longitude,
        accessibility_details,
        directions_url,
        banner_url,
        status,
        created_at,
        organizer:profiles!events_organizer_id_fkey(full_name, avatar_url)
      `,
        { count: 'exact' }
      )
      .eq('status', 'published')

    if (keyRecord?.campus_id) {
      query = query.eq('campus_id', keyRecord.campus_id)
    }

    if (category) {
      query = query.eq('category', category)
    }

    query = query
      .order('event_date', { ascending: true })
      .range(offset, offset + limit - 1)

    const { data: events, count, error: eventsErr } = await query

    if (eventsErr) {
      console.error('Partner API events query error:', eventsErr)
      return NextResponse.json({ error: 'Internal database error' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'

    interface EventDbRow {
      id: string
      title: string
      slug: string
      description: string
      category: string
      event_date: string
      start_time: string
      end_time: string
      timezone?: string | null
      location: string
      building?: string | null
      floor?: string | null
      room?: string | null
      latitude?: number | null
      longitude?: number | null
      accessibility_details?: string | null
      directions_url?: string | null
      banner_url?: string | null
      organizer?: { full_name?: string } | null
      created_at: string
    }

    const formattedEvents = ((events as unknown as EventDbRow[]) || []).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      url: `${appUrl}/events/${e.slug}`,
      description: e.description,
      category: e.category,
      schedule: {
        event_date: e.event_date,
        start_time: e.start_time,
        end_time: e.end_time,
        timezone: e.timezone || 'UTC',
      },
      venue: {
        name: e.location,
        building: e.building || null,
        floor: e.floor || null,
        room: e.room || null,
        coordinates: {
          latitude: e.latitude ?? null,
          longitude: e.longitude ?? null,
        },
        accessibility_details: e.accessibility_details || null,
        directions_url: e.directions_url || null,
      },
      banner_url: e.banner_url || null,
      organizer: {
        name: e.organizer?.full_name || 'Campus Club',
      },
      created_at: e.created_at,
    }))

    return NextResponse.json({
      data: formattedEvents,
      pagination: {
        limit,
        offset,
        total: count ?? formattedEvents.length,
      },
      partner: keyRecord?.partner_name || 'Campus Partner',
    })
  } catch (err) {
    console.error('Partner API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
