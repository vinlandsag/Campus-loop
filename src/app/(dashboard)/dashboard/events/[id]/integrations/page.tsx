import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageIntegrations } from '@/lib/auth/teams'
import { getEventIntegrations } from '@/app/actions/integration.actions'
import { IntegrationsClient } from '@/components/dashboard/IntegrationsClient'

interface IntegrationsPageProps {
  params: Promise<{ id: string }>
}

export default async function EventIntegrationsPage({ params }: IntegrationsPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, organizer_id')
    .eq('id', id)
    .single()

  if (error || !event) notFound()

  const role = await getEventUserRole(id, user.id)
  const isAuthorized = event.organizer_id === user.id || canManageIntegrations(role)

  if (!isAuthorized) {
    redirect('/dashboard/events')
  }

  const integrationsRes = await getEventIntegrations(id)

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <IntegrationsClient
        eventId={event.id}
        eventTitle={event.title}
        initialIntegrations={integrationsRes.data || []}
      />
    </div>
  )
}
