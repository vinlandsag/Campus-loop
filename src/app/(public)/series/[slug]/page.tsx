import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import {
  Calendar,
  MapPin,
  Users,
  Repeat,
  CheckCircle2,
  ArrowRight,
  GraduationCap,
  ChevronRight,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { Badge } from '@/components/ui/badge'
import { getEventSeries } from '@/app/actions/series.actions'
import { formatRecurrenceRule, calculateSeriesProgress } from '@/lib/events/recurrence'
import { SeriesActionButtons } from '@/components/events/SeriesActionButtons'

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps) {
  const resolved = await params
  const res = await getEventSeries(resolved.slug)
  if (!res.success || !res.series) {
    return { title: 'Series Not Found | CampusLoop' }
  }
  return {
    title: `${res.series.title} - Event Series | CampusLoop`,
    description: res.series.description || `Browse sessions in the ${res.series.title} series on CampusLoop.`,
  }
}

export default async function SeriesDetailPage({ params }: PageProps) {
  const resolved = await params
  const slug = resolved.slug
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const res = await getEventSeries(slug)
  if (!res.success || !res.series) {
    notFound()
  }

  const series = res.series
  const occurrences = series.occurrences || []
  const progress = calculateSeriesProgress(occurrences)

  // Fetch user's registrations across these occurrences
  let userRegisteredEventIds = new Set<string>()
  if (user && occurrences.length > 0) {
    const eventIds = occurrences.map((o) => o.id)
    const { data: userRegs } = await supabase
      .from('registrations')
      .select('event_id, status')
      .eq('user_id', user.id)
      .in('event_id', eventIds)
      .in('status', ['registered', 'checked_in'])

    if (userRegs) {
      userRegisteredEventIds = new Set(userRegs.map((r) => r.event_id))
    }
  }

  const recurrenceLabel = formatRecurrenceRule({
    recurrenceType: series.recurrence_type,
    intervalValue: series.interval_value,
    daysOfWeek: series.days_of_week,
    endType: series.end_type,
    endDate: series.end_date,
    occurrenceCount: series.occurrence_count,
  })

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  return (
    <div className="min-h-screen pb-16">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-[--border-subtle] bg-[--bg-surface]/50 backdrop-blur-sm py-3">
        <SectionContainer>
          <div className="flex items-center gap-2 text-xs text-[--text-muted]">
            <Link href="/" className="hover:text-[--text-primary] transition">Home</Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/events" className="hover:text-[--text-primary] transition">Events</Link>
            <ChevronRight className="h-3 w-3" />
            <span className="text-[--text-primary] font-medium truncate max-w-[200px] sm:max-w-none">
              {series.title}
            </span>
          </div>
        </SectionContainer>
      </div>

      {/* Series Hero */}
      <div className="relative overflow-hidden bg-gradient-to-b from-indigo-950/20 via-[--bg-surface] to-[--bg-default] py-12 border-b border-[--border-subtle]">
        <SectionContainer>
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 px-3 py-1 text-xs font-semibold">
                <Repeat className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Recurring Event Series
              </span>

              {series.campus && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[--accent-50] text-[--accent-700] dark:bg-[--accent-950]/50 dark:text-[--accent-300] px-3 py-1 text-xs font-semibold border border-[--accent-200] dark:border-[--accent-900]/60">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{series.campus.name}</span>
                </span>
              )}

              <Badge variant="outline" className="border-[--border-subtle] text-xs">
                {recurrenceLabel}
              </Badge>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[--text-primary]">
              {series.title}
            </h1>

            {series.description && (
              <p className="mt-4 text-base sm:text-lg text-[--text-secondary] leading-relaxed max-w-3xl">
                {series.description}
              </p>
            )}

            {/* Organizer Pill */}
            {series.organizer && (
              <div className="mt-4 flex items-center gap-2 text-xs text-[--text-muted]">
                <span>Organized by</span>
                <span className="font-semibold text-[--text-primary]">
                  {series.organizer.display_name}
                </span>
                {series.organizer.is_verified && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                )}
              </div>
            )}

            {/* Progress Bar Card */}
            <div className="mt-8 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <div>
                  <span className="font-bold text-[--text-primary]">Series Schedule & Progress</span>
                  <p className="text-xs text-[--text-muted] mt-0.5">
                    {progress.completed} of {progress.total} sessions completed • {progress.upcoming} upcoming
                    {progress.cancelled > 0 ? ` • ${progress.cancelled} cancelled` : ''}
                  </p>
                </div>
                {progress.nextSessionIndex && (
                  <Badge className="bg-emerald-600 text-white self-start sm:self-auto text-xs">
                    Next: Session {progress.nextSessionIndex}
                  </Badge>
                )}
              </div>

              {/* Progress Line */}
              <div className="mt-3 h-2 w-full rounded-full bg-[--bg-muted] overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-indigo-600 transition-all"
                  style={{
                    width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Series Actions */}
            <div className="mt-6">
              <SeriesActionButtons series={series} isLoggedIn={Boolean(user)} />
            </div>
          </div>
        </SectionContainer>
      </div>

      {/* Sessions List Section */}
      <SectionContainer className="pt-10">
        <div className="max-w-4xl">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-bold text-[--text-primary]">All Sessions</h2>
              <p className="text-xs text-[--text-muted] mt-0.5">
                Register for the whole series above or browse individual sessions below.
              </p>
            </div>
            <span className="text-xs font-semibold text-[--text-muted]">
              {occurrences.length} Total Sessions
            </span>
          </div>

          <div className="space-y-4">
            {occurrences.map((occ, idx) => {
              const isPast = occ.event_date ? occ.event_date < todayStr : false
              const isToday = occ.event_date === todayStr
              const isCancelled = occ.status === 'cancelled'
              const isUserRegistered = userRegisteredEventIds.has(occ.id)

              let formattedDate = occ.event_date || ''
              try {
                if (occ.event_date) {
                  formattedDate = format(parseISO(occ.event_date), 'EEEE, MMMM d, yyyy')
                }
              } catch {}

              return (
                <div
                  key={occ.id}
                  className={`group rounded-2xl border p-5 sm:p-6 transition-all ${
                    isCancelled
                      ? 'border-rose-200/60 bg-rose-50/30 opacity-75 dark:border-rose-900/40 dark:bg-rose-950/20'
                      : isPast
                        ? 'border-[--border-subtle] bg-[--bg-surface]/60 opacity-80'
                        : 'border-[--border-subtle] bg-[--bg-surface] shadow-sm hover:border-[--accent-400] hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-[--accent-600]">
                          Session {occ.series_sequence_index || idx + 1}
                        </span>

                        {isCancelled ? (
                          <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300 text-[10px]">
                            Cancelled
                          </Badge>
                        ) : isToday ? (
                          <Badge className="bg-amber-500 text-white text-[10px]">
                            Today
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="outline" className="border-zinc-300 text-zinc-500 text-[10px]">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                            Upcoming
                          </Badge>
                        )}

                        {isUserRegistered && (
                          <Badge className="bg-emerald-600 text-white gap-1 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Enrolled
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-[--text-primary] group-hover:text-[--accent-600] transition-colors">
                        <Link href={`/events/${occ.slug}`}>{occ.title}</Link>
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[--text-muted]">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          {formattedDate} • {occ.start_time} - {occ.end_time}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-zinc-400" />
                          {occ.location}
                        </span>
                        {occ.capacity !== null && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-zinc-400" />
                            {occ.active_registrations_count || 0}/{occ.capacity} spots
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Link
                        href={`/events/${occ.slug}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-xs font-semibold text-[--text-primary] transition hover:bg-[--bg-muted]"
                      >
                        <span>View Session</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </SectionContainer>
    </div>
  )
}
