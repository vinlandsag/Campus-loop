import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, HeartHandshake, Users, Award, Camera, QrCode } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import {
  getEventUserRole,
  canManageVolunteers,
  canCheckInVolunteers,
} from '@/lib/auth/teams'
import {
  getEventVolunteerRoles,
  getEventVolunteerSignups,
} from '@/app/actions/volunteer.actions'
import { VolunteerManagementClient } from '@/components/dashboard/VolunteerManagementClient'

interface VolunteersPageProps {
  params: Promise<{ id: string }>
}

export default async function EventVolunteersPage({ params }: VolunteersPageProps) {
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

  const role = await getEventUserRole(id, user.id)
  const canManage = canManageVolunteers(role)
  const canCheckIn = canCheckInVolunteers(role)

  if (!canManage && !canCheckIn) {
    redirect(`/dashboard/events/${id}/participants`)
  }

  const [rolesRes, signupsRes] = await Promise.all([
    getEventVolunteerRoles(id),
    getEventVolunteerSignups(id),
  ])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/dashboard/events/${id}/participants`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
            >
              <ArrowLeft className="h-4 w-4" />
              Event Management
            </Link>
            <span className="text-zinc-400">/</span>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Volunteers
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Volunteer Crew & Shifts
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/certificates`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:bg-[--bg-muted]"
          >
            <Award className="h-3.5 w-3.5 text-amber-500" />
            Certificates
          </Link>
          <Link
            href={`/dashboard/events/${id}/gallery`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:bg-[--bg-muted]"
          >
            <Camera className="h-3.5 w-3.5 text-purple-500" />
            Gallery
          </Link>
          <Link
            href={`/dashboard/events/${id}/check-in`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
          >
            <QrCode className="h-3.5 w-3.5" />
            Check-In
          </Link>
        </div>
      </div>

      {/* Sub navigation bar */}
      <div className="flex overflow-x-auto gap-2 border-b border-[--border-subtle] pb-2 text-xs no-scrollbar">
        <Link
          href={`/dashboard/events/${id}/participants`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Users className="h-3.5 w-3.5 text-zinc-500" />
          Participants
        </Link>
        <Link
          href={`/dashboard/events/${id}/certificates`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Award className="h-3.5 w-3.5 text-amber-500" />
          Certificates
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
          Volunteers
        </span>
        <Link
          href={`/dashboard/events/${id}/gallery`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Camera className="h-3.5 w-3.5 text-purple-500" />
          Photo Gallery
        </Link>
      </div>

      <VolunteerManagementClient
        eventId={id}
        eventTitle={event.title}
        initialRoles={rolesRes.success ? (rolesRes.data || []) : []}
        initialSignups={signupsRes.success ? (signupsRes.data || []) : []}
        canManage={canManage}
        canCheckIn={canCheckIn}
      />
    </div>
  )
}
