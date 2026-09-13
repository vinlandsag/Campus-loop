import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Users, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageQuestions } from '@/lib/auth/teams'
import { getEventQuestions } from '@/app/actions/question.actions'
import { QuestionsBuilderClient } from '@/components/dashboard/QuestionsBuilderClient'

interface QuestionsPageProps {
  params: Promise<{ id: string }>
}

export default async function EventQuestionsPage({ params }: QuestionsPageProps) {
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
  if (!canManageQuestions(role)) {
    redirect('/dashboard/events')
  }

  const { questions } = await getEventQuestions(id)

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
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Registration Questions
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Registration Questions
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/team`}
            className="inline-flex items-center gap-2 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-sm font-medium text-[--text-primary] shadow-sm hover:bg-[--bg-muted]"
          >
            <Shield className="h-4 w-4" />
            Manage Team
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

      <QuestionsBuilderClient eventId={event.id} initialQuestions={questions} />
    </div>
  )
}
