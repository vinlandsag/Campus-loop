import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface FeedJsonEvent {
  id: string
  title: string
  slug: string
  description?: string | null
  category: string
  created_at: string
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
  organizer?: { full_name?: string; avatar_url?: string | null } | null
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const supabase = await createClient()

    let query = supabase
      .from('events')
      .select(`
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
      `)
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .limit(100)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Error fetching JSON feed events:', error)
      return NextResponse.json({ error: 'Failed to generate feed' }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'

    // Format secure public feed items (zero private attendee leakage)
    const feedItems = ((events as unknown as FeedJsonEvent[]) || []).map((e) => ({
      id: e.id,
      title: e.title,
      url: `${appUrl}/events/${e.slug}`,
      summary: e.description,
      category: e.category,
      date_published: e.created_at,
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
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        accessibility: e.accessibility_details || null,
        directions_url: e.directions_url || null,
      },
      image: e.banner_url || null,
      author: {
        name: e.organizer?.full_name || 'Campus Club',
        avatar_url: e.organizer?.avatar_url || null,
      },
    }))

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'CampusLoop Events Feed',
      home_page_url: appUrl,
      feed_url: `${appUrl}/api/v1/feed.json`,
      description: 'Official upcoming campus public events feed',
      items: feedItems,
    }

    return NextResponse.json(feed, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (err) {
    console.error('Feed generation exception:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
