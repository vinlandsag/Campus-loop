import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import {
  ArrowLeft,
  QrCode,
  Users,
  Shield,
  HelpCircle,
  Megaphone,
  TrendingUp,
  Award,
  HeartHandshake,
  Camera,
  Languages,
  Webhook,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canViewParticipants } from '@/lib/auth/teams'
import { getEventQuestions, getEventAnswersMap } from '@/app/actions/question.actions'
import { ParticipantsClient } from '@/components/dashboard/ParticipantsClient'

interface ParticipantsPageProps {
  params: Promise<{ id: string }>
}

export default async function ParticipantsPage({ params }: ParticipantsPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, title, slug, capacity, organizer_id')
    .eq('id', id)
    .single()

  if (eventError || !event) {
    notFound()
  }

  const role = await getEventUserRole(id, user.id)
  if (!canViewParticipants(role)) {
    redirect('/dashboard/events')
  }

  const {
    canViewRegistrationAnswers,
    canManageTeam,
    canManageQuestions,
    canSendAnnouncements,
    canViewAnalytics,
    canManageCertificates,
    canManageVolunteers,
    canManageGallery,
  } = await import('@/lib/auth/teams')

  const canSeeAnswers = canViewRegistrationAnswers(role)

  // Fetch registrations, and conditionally questions/answers based on role
  const [regRes, questionsRes, answersMap] = await Promise.all([
    supabase
      .from('registrations')
      .select('*')
      .eq('event_id', id)
      .order('registered_at', { ascending: true }),
    canSeeAnswers ? getEventQuestions(id) : Promise.resolve({ questions: [] }),
    canSeeAnswers ? getEventAnswersMap(id) : Promise.resolve(new Map<string, Record<string, string>>()),
  ])

  const registrations = regRes.data || []
  const questions = questionsRes.questions || []

  // Fetch attendee profiles
  const userIds = Array.from(new Set(registrations.map((r) => r.user_id)))
  const profileMap = new Map<string, { full_name: string | null; email: string; avatar_url: string | null }>()

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds)

    if (profiles) {
      profiles.forEach((p) => {
        profileMap.set(p.id, {
          full_name: p.full_name,
          email: p.email || '',
          avatar_url: p.avatar_url || null,
        })
      })
    }
  }

  // Pre-calculate waitlist positions in FIFO order
  const waitlistPositions = new Map<string, number>()
  let counter = 0
  for (const reg of registrations) {
    if (reg.status === 'waitlisted') {
      counter += 1
      waitlistPositions.set(reg.id, counter)
    }
  }

  const participants = registrations.map((reg) => {
    const prof = profileMap.get(reg.user_id)
    const waitlistPosition = waitlistPositions.get(reg.id) ?? null
    const answers = canSeeAnswers ? (answersMap.get(reg.id) || {}) : {}

    return {
      id: reg.id,
      userId: reg.user_id,
      registered_at: reg.registered_at,
      status: reg.status,
      ticket_code: reg.ticket_code ?? null,
      checked_in_at: reg.checked_in_at ?? null,
      waitlist_position: waitlistPosition,
      answers,
      user: {
        full_name: prof?.full_name || 'Attendee',
        email: prof?.email || '',
        avatar_url: prof?.avatar_url || null,
      },
    }
  })

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/events"
            className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to events
          </Link>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Attendee Management
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/check-in`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <QrCode className="h-3.5 w-3.5" />
            Check-In Station
          </Link>
        </div>
      </div>

      {/* Organizer Tools Navigation Sub-bar */}
      <div className="flex overflow-x-auto gap-2 border-b border-[--border-subtle] pb-2 text-xs no-scrollbar">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Users className="h-3.5 w-3.5" />
          Participants
        </span>
        <Link
          href={`/dashboard/events/${id}/check-in`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <QrCode className="h-3.5 w-3.5 text-emerald-600" />
          Scanner Station
        </Link>
        {canManageTeam(role) && (
          <Link
            href={`/dashboard/events/${id}/team`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Shield className="h-3.5 w-3.5 text-purple-600" />
            Team Roles
          </Link>
        )}
        {canManageQuestions(role) && (
          <Link
            href={`/dashboard/events/${id}/questions`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <HelpCircle className="h-3.5 w-3.5 text-blue-600" />
            Registration Questions
          </Link>
        )}
        {canSendAnnouncements(role) && (
          <Link
            href={`/dashboard/events/${id}/announcements`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Megaphone className="h-3.5 w-3.5 text-amber-600" />
            Announcements
          </Link>
        )}
        {canViewAnalytics(role) && (
          <Link
            href={`/dashboard/events/${id}/analytics`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <TrendingUp className="h-3.5 w-3.5 text-cyan-600" />
            Analytics
          </Link>
        )}
        {canManageCertificates(role) && (
          <Link
            href={`/dashboard/events/${id}/certificates`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Award className="h-3.5 w-3.5 text-amber-500" />
            Certificates
          </Link>
        )}
        {canManageVolunteers(role) && (
          <Link
            href={`/dashboard/events/${id}/volunteers`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
            Volunteers
          </Link>
        )}
        {canManageGallery(role) && (
          <Link
            href={`/dashboard/events/${id}/gallery`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Camera className="h-3.5 w-3.5 text-purple-500" />
            Photo Gallery
          </Link>
        )}
        <Link
          href={`/dashboard/events/${id}/translations`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Languages className="h-3.5 w-3.5 text-blue-500" />
          Translations
        </Link>
        <Link
          href={`/dashboard/events/${id}/integrations`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Webhook className="h-3.5 w-3.5 text-indigo-500" />
          Integrations
        </Link>
      </div>

      <ParticipantsClient
        event={event}
        initialParticipants={participants}
        questions={questions}
        userRole={role}
      />
    </div>
  )

}
