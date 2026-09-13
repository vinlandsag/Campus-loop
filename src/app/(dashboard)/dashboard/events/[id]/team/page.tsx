import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Users, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventTeam } from '@/app/actions/team.actions'
import { TeamManagementClient } from '@/components/dashboard/TeamManagementClient'

interface TeamPageProps {
  params: Promise<{ id: string }>
}

export default async function EventTeamPage({ params }: TeamPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .select('id, title, slug, organizer_id')
    .eq('id', id)
    .single()

  if (eventErr || !event) {
    notFound()
  }

  const { success, team, currentUserRole } = await getEventTeam(id)
  if (!success || !currentUserRole) {
    redirect('/dashboard/events')
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
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
            <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
              Team Roles
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Organizer Team & Roles
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/check-in`}
            className="inline-flex items-center gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-sm font-medium text-[--text-primary] shadow-sm hover:bg-[--bg-muted]"
          >
            <QrCode className="h-4 w-4" />
            Check-In Station
          </Link>
          <Link
            href={`/dashboard/events/${id}/participants`}
            className="inline-flex items-center gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-sm font-medium text-[--text-primary] shadow-sm hover:bg-[--bg-muted]"
          >
            <Users className="h-4 w-4" />
            Participants
          </Link>
        </div>
      </div>

      <TeamManagementClient
        eventId={event.id}
        initialTeam={team}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
