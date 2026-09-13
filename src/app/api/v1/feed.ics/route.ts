import { createClient } from '@/lib/supabase/server'
import { generateSeriesIcs } from '@/lib/calendar/ics'

interface FeedIcsEvent {
  id: string
  title: string
  slug: string
  description?: string | null
  event_date: string
  start_time: string
  end_time: string
  location: string
  building?: string | null
  room?: string | null
  reschedule_count?: number | null
}

export async function GET(_request: Request) {
  try {
    const supabase = await createClient()

    const { data: events, error } = await supabase
      .from('events')
      .select(`
        id,
        title,
        slug,
        description,
        event_date,
        start_time,
        end_time,
        location,
        building,
        room,
        reschedule_count,
        organizer:profiles!events_organizer_id_fkey(full_name)
      `)
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .limit(100)

    if (error) {
      return new Response('Failed to generate calendar feed', { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'

    const sessions = ((events as unknown as FeedIcsEvent[]) || []).map((e) => ({
      id: e.id,
      title: e.title,
      eventDate: e.event_date,
      startTime: e.start_time,
      endTime: e.end_time,
      location: e.building ? `${e.location} (${e.building}${e.room ? `, ${e.room}` : ''})` : e.location,
      description: `${e.description || ''}\n\nMore details: ${appUrl}/events/${e.slug}`,
      sequence: e.reschedule_count ?? 0,
      status: 'CONFIRMED' as const,
    }))

    const icsContent = generateSeriesIcs({
      seriesId: 'campusloop-public-feed',
      seriesTitle: 'CampusLoop Events Calendar',
      description: 'Official upcoming campus public events feed',
      organizerName: 'CampusLoop',
      sessions,
    })

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="campusloop-events.ics"',
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (err) {
    console.error('ICS Feed generation exception:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
