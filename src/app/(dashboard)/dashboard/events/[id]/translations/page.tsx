import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageTranslations } from '@/lib/auth/teams'
import { getEventTranslations } from '@/app/actions/translation.actions'
import { TranslationsClient } from '@/components/dashboard/TranslationsClient'

interface TranslationsPageProps {
  params: Promise<{ id: string }>
}

export default async function EventTranslationsPage({ params }: TranslationsPageProps) {
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
  const isAuthorized = event.organizer_id === user.id || canManageTranslations(role)

  if (!isAuthorized) {
    redirect('/dashboard/events')
  }

  const translationsRes = await getEventTranslations(id)

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <TranslationsClient
        eventId={event.id}
        eventTitle={event.title}
        initialTranslations={translationsRes.data || []}
      />
    </div>
  )
}
