import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import {
  Radio,
  Pin,
  AlertTriangle,
  MapPin,
  Clock,
  Utensils,
  Megaphone,
  ArrowLeft,
  Calendar,
  RefreshCcw,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getEventAnnouncements } from '@/app/actions/announcement.actions'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { Badge } from '@/components/ui/badge'
import { APP_NAME } from '@/lib/constants'
import type { AnnouncementCategory } from '@/types'

interface LiveEventPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: LiveEventPageProps): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data: event } = await supabase
    .from('events')
    .select('title')
    .eq('slug', slug)
    .maybeSingle()

  if (!event) return { title: `Live Event Board | ${APP_NAME}` }

  return {
    title: `Live Board: ${event.title} | ${APP_NAME}`,
    description: `Real-time announcements, pinned schedule alerts, venue changes, and live updates for ${event.title}.`,
  }
}

function getCategoryBadge(category: AnnouncementCategory) {
  switch (category) {
    case 'emergency':
      return {
        label: 'Urgent / Emergency',
        badgeColor: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
        icon: AlertTriangle,
      }
    case 'venue_change':
      return {
        label: 'Venue Change',
        badgeColor: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300',
        icon: MapPin,
      }
    case 'schedule':
      return {
        label: 'Schedule Alert',
        badgeColor: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
        icon: Clock,
      }
    case 'food':
      return {
        label: 'Food / Refreshments',
        badgeColor: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
        icon: Utensils,
      }
    default:
      return {
        label: 'Announcement',
        badgeColor: 'border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
        icon: Megaphone,
      }
  }
}

export default async function LiveEventPage({ params }: LiveEventPageProps) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: event, error } = await supabase
    .from('events')
    .select('id, title, slug, location, event_date, start_time, end_time, status, organizer_id')
    .eq('slug', slug)
    .maybeSingle()

  if (error || !event) {
    notFound()
  }

  const { announcements } = await getEventAnnouncements(event.id)

  const pinned = announcements.filter((a) => a.is_pinned)
  const regular = announcements.filter((a) => !a.is_pinned)

  return (
    <SectionContainer as="div" className="py-8 max-w-3xl mx-auto space-y-8">
      {/* Header & Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href={`/events/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[--text-secondary] hover:text-[--text-primary] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Event Details</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wide uppercase">
            Live Updates Active
          </span>
        </div>
      </div>

      {/* Hero Live Status Card */}
      <div className="rounded-3xl border border-[--border-subtle] bg-[--bg-surface] p-6 sm:p-8 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 gap-1 text-xs">
                <Radio className="h-3 w-3 animate-pulse text-amber-700" />
                Live Event Board
              </Badge>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[--text-primary]">
              {event.title}
            </h1>
          </div>

          <Link
            href={`/events/${slug}/live`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/60 px-3 py-1.5 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] transition-colors self-start sm:self-center"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Refresh Feed</span>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-[--text-secondary] pt-2 border-t border-[--border-subtle]">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-zinc-500" />
            {event.event_date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-zinc-500" />
            {event.start_time} - {event.end_time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-zinc-500" />
            {event.location}
          </span>
        </div>
      </div>

      {/* Pinned Updates Section */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            <Pin className="h-3.5 w-3.5" />
            <span>Pinned Important Updates</span>
          </div>

          <div className="space-y-3">
            {pinned.map((ann) => {
              const meta = getCategoryBadge(ann.category || 'general')
              const Icon = meta.icon

              return (
                <div
                  key={ann.id}
                  className="rounded-2xl border-2 border-amber-300 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 p-5 shadow-sm space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`gap-1 text-xs ${meta.badgeColor}`}>
                      <Icon className="h-3.5 w-3.5" />
                      <span>{meta.label}</span>
                    </Badge>
                    <span className="text-[11px] text-[--text-muted]">
                      {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-[--text-primary]">
                    {ann.title}
                  </h3>
                  <p className="text-sm text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Chronological Timeline Stream */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-[--text-primary]">
            Announcement Stream ({announcements.length})
          </h2>
        </div>

        {announcements.length === 0 ? (
          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-8 text-center space-y-2">
            <Megaphone className="h-8 w-8 text-zinc-400 mx-auto" />
            <p className="text-sm font-semibold text-[--text-primary]">No announcements broadcast yet</p>
            <p className="text-xs text-[--text-muted]">
              Pinned alerts and live venue or schedule updates from event organizers will appear here in real time.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {regular.map((ann) => {
              const meta = getCategoryBadge(ann.category || 'general')
              const Icon = meta.icon

              return (
                <div
                  key={ann.id}
                  className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-xs transition-all hover:border-[--border-default] space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={`gap-1 text-[11px] ${meta.badgeColor}`}>
                      <Icon className="h-3 w-3" />
                      <span>{meta.label}</span>
                    </Badge>
                    <span className="text-[11px] text-[--text-muted]">
                      {new Date(ann.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-[--text-primary]">
                    {ann.title}
                  </h3>
                  <p className="text-xs text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
                    {ann.message}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </SectionContainer>
  )
}
