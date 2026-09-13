import Link from 'next/link'
import Image from 'next/image'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, MapPin, ChevronRight, GraduationCap } from 'lucide-react'

export interface EventListCardProps {
  id: string
  title: string
  slug: string
  category: string
  event_date: string
  start_time: string
  location: string
  banner_url: string | null
  campus?: { name: string; slug?: string } | null
  statusLabel?: React.ReactNode
  is_paid?: boolean
  price?: number | null
}

export function EventListCard({
  title,
  slug,
  category,
  event_date,
  start_time,
  location,
  banner_url,
  campus,
  statusLabel,
  is_paid = false,
  price = null,
}: EventListCardProps) {
  // Compute date/time formatting safely
  let formattedDate = event_date
  let formattedTime = start_time
  try {
    const dateObj = parseISO(event_date)
    formattedDate = format(dateObj, 'MMM d, yyyy')

    const [hours, minutes] = start_time.split(':')
    const timeDate = new Date()
    timeDate.setHours(parseInt(hours || '0', 10), parseInt(minutes || '0', 10))
    formattedTime = format(timeDate, 'h:mm a')
  } catch {
    // fallback
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm transition-all hover:border-[--border-default] hover:shadow-md sm:flex-row sm:items-stretch sm:h-32">
      <Link
        href={`/events/${slug}`}
        className="flex min-w-0 flex-1 items-stretch no-underline"
        aria-label={`Open event: ${title}`}
      >
        {/* Banner */}
        <div className="relative h-48 w-full shrink-0 overflow-hidden bg-[--bg-muted] sm:h-full sm:w-48 sm:min-w-[12rem]">
          {banner_url ? (
            <Image
              src={banner_url}
              alt={title}
              fill
              className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
              sizes="(max-width: 640px) 100vw, 192px"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[--accent-100] to-[--accent-50]">
              <Calendar className="h-8 w-8 text-[--accent-200]" />
            </div>
          )}

          {/* Category & Campus Pill for Mobile */}
          <div className="absolute left-4 top-4 flex flex-wrap gap-1.5 sm:hidden">
            <div className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold tracking-wide text-[--text-primary] shadow-sm backdrop-blur-md">
              {category}
            </div>
            {campus && (
              <div className="flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[--accent-700] shadow-sm backdrop-blur-md">
                <GraduationCap className="h-3 w-3" />
                {campus.name}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="hidden sm:mb-1.5 sm:flex sm:items-center sm:gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[--accent-600]">
                  {category}
                </span>
                {campus && (
                  <>
                    <span className="text-xs text-[--text-muted]">•</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[--accent-700] dark:text-[--accent-400]">
                      <GraduationCap className="h-3 w-3" />
                      {campus.name}
                    </span>
                  </>
                )}
              </div>
              <h3 className="line-clamp-2 font-display text-lg font-bold leading-tight text-[--text-primary] sm:line-clamp-1">
                {title}
              </h3>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center gap-2 text-sm text-[--text-secondary]">
              <Calendar className="h-4 w-4 shrink-0 text-[--text-muted]" />
              <span className="whitespace-nowrap">{formattedDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[--text-secondary]">
              <Clock className="h-4 w-4 shrink-0 text-[--text-muted]" />
              <span className="whitespace-nowrap">{formattedTime}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-[--text-secondary] sm:line-clamp-1">
              <MapPin className="h-4 w-4 shrink-0 text-[--text-muted]" />
              <span className="line-clamp-1">{location}</span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-[--bg-muted] px-2.5 py-0.5 text-xs font-semibold text-[--text-primary]">
              {is_paid && price !== null && price > 0 ? `₹${price}` : 'Free'}
            </span>
          </div>
        </div>
      </Link>

      {statusLabel && (
        <div className="flex shrink-0 flex-col items-end justify-center gap-2 border-t border-[--border-subtle] bg-[--bg-surface] p-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pr-4">
          {statusLabel}
        </div>
      )}

      {/* Chevron indicator for Desktop */}
      <div className="hidden pr-5 text-[--text-muted] transition-colors group-hover:text-[--text-primary] sm:flex sm:items-center">
        <ChevronRight className="h-5 w-5" />
      </div>
    </div>
  )
}
