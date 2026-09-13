import Link from 'next/link'
import { CalendarX, RefreshCw, Compass } from 'lucide-react'
import { EventCardSkeleton } from './EventCard'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EventGridProps {
  children: React.ReactNode
  isEmpty?: boolean
  emptyTitle?: string
  emptyDescription?: string
  resetHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export function EventGrid({
  children,
  isEmpty = false,
  emptyTitle,
  emptyDescription,
  resetHref = '/events',
  secondaryLabel = "Explore This Week's Events",
  secondaryHref = '/events?view=this-week',
}: EventGridProps) {
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--border-strong] bg-[--bg-surface] px-6 py-20 text-center shadow-sm">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[--bg-muted] text-[--text-muted]">
          <CalendarX className="h-7 w-7 text-[--accent-600]" />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold text-[--text-primary]">
          {emptyTitle || 'No events found'}
        </h3>
        <p className="mt-1.5 max-w-md text-sm text-[--text-secondary] leading-relaxed">
          {emptyDescription ||
            "We couldn't find any events matching your selected filters. Try broadening your criteria or exploring upcoming highlights."}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={resetHref}
            className={cn(
              buttonVariants({ variant: 'default', size: 'sm' }),
              'gap-2 font-medium shadow-sm'
            )}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset All Filters
          </Link>
          {secondaryHref && (
            <Link
              href={secondaryHref}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-2 font-medium'
              )}
            >
              <Compass className="h-3.5 w-3.5" />
              {secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  )
}

export function EventGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </div>
  )
}
