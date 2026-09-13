import { createClient } from '@/lib/supabase/server'

interface FeedRssEvent {
  id: string
  title: string
  slug: string
  description?: string | null
  category: string
  event_date: string
  start_time: string
  end_time: string
  location: string
  building?: string | null
  room?: string | null
  created_at: string
  organizer?: { full_name?: string } | null
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
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
        category,
        event_date,
        start_time,
        end_time,
        location,
        building,
        room,
        created_at,
        organizer:profiles!events_organizer_id_fkey(full_name)
      `)
      .eq('status', 'published')
      .order('event_date', { ascending: true })
      .limit(50)

    if (error) {
      return new Response('Failed to generate RSS feed', { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'

    const itemsXml = ((events as unknown as FeedRssEvent[]) || [])
      .map((e) => {
        const eventUrl = `${appUrl}/events/${e.slug}`
        const pubDate = new Date(e.created_at).toUTCString()
        const locationText = e.building ? `${e.location} (${e.building}${e.room ? `, ${e.room}` : ''})` : e.location

        return `
    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${eventUrl}</link>
      <guid isPermaLink="true">${eventUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(e.category)}</category>
      <description><![CDATA[${e.description || ''} - Location: ${locationText}]]></description>
      <author>${escapeXml(e.organizer?.full_name || 'Campus Organizer')}</author>
    </item>`
      })
      .join('')

    const rssXml = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>CampusLoop Events Feed</title>
    <link>${appUrl}</link>
    <description>Upcoming public student and campus events</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${appUrl}/api/v1/feed.rss" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`

    return new Response(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1200',
      },
    })
  } catch (err) {
    console.error('RSS Feed generation exception:', err)
    return new Response('Internal server error', { status: 500 })
  }
}
