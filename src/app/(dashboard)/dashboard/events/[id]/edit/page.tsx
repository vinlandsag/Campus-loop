import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EventForm } from '@/components/dashboard/EventForm'

interface EditEventPageProps {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Authorize using unified event team permissions (owner or editor)
  const { getEventUserRole, canEditEvent } = await import('@/lib/auth/teams')
  const userRole = await getEventUserRole(id, user.id)

  if (!canEditEvent(userRole)) {
    redirect('/dashboard/events')
  }

  const { data: event, error } = await supabase
    .from('events')
    .select('*, registrations(count)')
    .eq('id', id)
    .single()

  if (error || !event) {
    notFound()
  }

  const registrationCount =
    event.active_registrations_count ?? event.registrations?.[0]?.count ?? 0

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold text-[--text-primary]">Edit Event</h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Update the details for &ldquo;{event.title}&rdquo;.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-6 sm:p-8">
        <EventForm
          mode="edit"
          currentRegistrationCount={registrationCount}
          initialData={{
            id: event.id,
            title: event.title,
            description: event.description || '',
            category: event.category,
            event_date: event.event_date,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location,
            capacity: event.capacity,
            banner_url: event.banner_url,
            status: event.status,
            is_paid: event.is_paid ?? false,
            price: event.price ?? null,
          }}
        />
      </div>
    </div>
  )
}
