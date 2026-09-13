import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventNetworkingData } from '@/app/actions/networking.actions'
import { NetworkingHubClient } from '@/components/events/NetworkingHubClient'

interface EventNetworkingPageProps {
  params: Promise<{ slug: string }>
}

export default async function EventNetworkingPage({ params }: EventNetworkingPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=/events/${slug}/networking`)
  }

  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, slug, status')
    .eq('slug', slug)
    .single()

  if (error || !event || event.status === 'draft') {
    notFound()
  }

  const networkingRes = await getEventNetworkingData(event.id)

  return (
    <div className="min-h-screen bg-[--bg-base] py-8 px-4 sm:px-6 lg:px-8">
      <NetworkingHubClient
        eventId={event.id}
        eventSlug={event.slug}
        eventTitle={event.title}
        initialData={{
          isOptedIn: networkingRes.isOptedIn ?? false,
          exchangeToken: networkingRes.exchangeToken ?? '',
          myCard: networkingRes.myCard ?? null,
          incomingRequests: networkingRes.incomingRequests || [],
          outgoingRequests: networkingRes.outgoingRequests || [],
          connectedCards: networkingRes.connectedCards || [],
          directory: networkingRes.directory || [],
        }}
      />
    </div>
  )
}
