import { NextResponse } from 'next/server'

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://campusloop.internal'

  const apiDocs = {
    title: 'CampusLoop Partner REST API Documentation',
    version: 'v1',
    description:
      'Secure, read-only API access for university portals, student union displays, and campus mobile apps. Private attendee data, student emails, tickets, and drafts are strictly prevented from entering this API.',
    authentication: {
      type: 'API Key',
      header_options: [
        'Authorization: Bearer <cl_live_...>',
        'X-API-Key: <cl_live_...>',
      ],
      description: 'API keys are generated and approved by CampusLoop university administrators.',
    },
    rate_limits: {
      default: '60 requests per minute per key',
      headers_returned: ['Retry-After (on HTTP 429)'],
    },
    endpoints: [
      {
        path: '/api/v1/events',
        method: 'GET',
        description: 'Retrieve published campus events scoped to your partner campus.',
        parameters: [
          { name: 'limit', type: 'integer', default: 20, max: 100, description: 'Number of events to return' },
          { name: 'offset', type: 'integer', default: 0, description: 'Number of events to skip' },
          { name: 'category', type: 'string', description: 'Filter by category (academic, social, sports, tech, etc.)' },
        ],
        example_curl: `curl -H "Authorization: Bearer cl_live_demo" "${appUrl}/api/v1/events?limit=10"`,
      },
      {
        path: '/api/v1/feed.json',
        method: 'GET',
        description: 'Public JSON Feed 1.1 of upcoming public events for web widgets.',
        parameters: [{ name: 'category', type: 'string' }],
      },
      {
        path: '/api/v1/feed.rss',
        method: 'GET',
        description: 'Standard RSS 2.0 XML feed of published events for university CMS embeds.',
      },
      {
        path: '/api/v1/feed.ics',
        method: 'GET',
        description: 'RFC 5545 iCalendar calendar subscription stream with automatic reschedule updates.',
      },
    ],
    data_privacy_guarantee: {
      excluded_fields: [
        'student attendee identities',
        'registration counts and capacity waitlists',
        'ticket verification codes and QR payloads',
        'internal registration form question answers',
        'draft and unpublished events',
      ],
      status: 'Enforced via database RLS and server-side filtering',
    },
  }

  return NextResponse.json(apiDocs, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
