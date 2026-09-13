import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Award, Users, QrCode, HeartHandshake, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventUserRole, canManageCertificates } from '@/lib/auth/teams'
import {
  getEventCertificateConfig,
  getEventCertificatesList,
} from '@/app/actions/certificate.actions'
import { CertificateSettingsClient } from '@/components/dashboard/CertificateSettingsClient'

interface CertificatesPageProps {
  params: Promise<{ id: string }>
}

export default async function EventCertificatesPage({ params }: CertificatesPageProps) {
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
  if (!canManageCertificates(role)) {
    redirect(`/dashboard/events/${id}/participants`)
  }

  const [configRes, certsRes] = await Promise.all([
    getEventCertificateConfig(id),
    getEventCertificatesList(id),
  ])

  return (
    <div className="space-y-6">
      {/* Header & Breadcrumb */}
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
              Certificates
            </span>
          </div>
          <h1 className="mt-2 font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Certificates of Completion
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">{event.title}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/events/${id}/volunteers`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:bg-[--bg-muted]"
          >
            <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
            Volunteers
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
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
          <Award className="h-3.5 w-3.5 text-amber-500" />
          Certificates
        </span>
        <Link
          href={`/dashboard/events/${id}/volunteers`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <HeartHandshake className="h-3.5 w-3.5 text-amber-500" />
          Volunteers
        </Link>
        <Link
          href={`/dashboard/events/${id}/gallery`}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <Camera className="h-3.5 w-3.5 text-purple-500" />
          Photo Gallery
        </Link>
      </div>

      <CertificateSettingsClient
        eventId={id}
        eventTitle={event.title}
        initialConfig={configRes.success ? configRes.data : null}
        issuedCertificates={certsRes.success ? (certsRes.data || []) : []}
      />
    </div>
  )
}
