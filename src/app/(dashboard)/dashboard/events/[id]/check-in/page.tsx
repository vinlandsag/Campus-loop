import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { CheckInScannerClient } from '@/components/dashboard/CheckInScannerClient'
import { getEventAttendanceStats } from '@/app/actions/attendance.actions'

interface CheckInPageProps {
  params: Promise<{ id: string }>
}

export default async function EventCheckInPage({ params }: CheckInPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Verify event exists and is owned by caller (or organizer)
  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug, capacity, organizer_id')
    .eq('id', id)
    .single()

  if (eventErr || !event) {
    notFound()
  }

  // Authorize using unified event team permissions
  const { getEventUserRole, canCheckIn } = await import('@/lib/auth/teams')
  const userRole = await getEventUserRole(id, user.id)

  if (!canCheckIn(userRole)) {
    redirect('/dashboard/events')
  }

  // Fetch initial attendance statistics
  const initialStats = await getEventAttendanceStats(id)

  return (
    <div className="space-y-6">
      {/* Header and navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/events/${id}/participants`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
            >
              <ArrowLeft className="h-4 w-4" />
              Participants
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Check-in Station
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Attendee Check-In
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/participants`}
            className="inline-flex items-center gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-sm font-medium text-[--text-primary] shadow-sm hover:bg-[--bg-muted]"
          >
            <Users className="h-4 w-4" />
            View Participants List
          </Link>
        </div>
      </div>

      <CheckInScannerClient
        eventId={event.id}
        eventTitle={event.title}
        eventSlug={event.slug}
        initialStats={initialStats}
      />
    </div>
  )
}
