import { EventGridSkeleton } from '@/components/events/EventGrid'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { Search } from 'lucide-react'

export default function EventsLoading() {
  return (
    <SectionContainer as="div" className="py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[--text-primary]">
          Discover Events
        </h1>
        <p className="mt-2 text-[--text-secondary]">
          Find and register for the best events happening on campus.
        </p>
      </div>

      <div className="space-y-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
              <div className="h-10 w-full rounded-lg border border-[--border-default] bg-[--bg-muted]" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-10 w-[140px] animate-pulse rounded-md bg-[--bg-muted]" />
              <div className="h-10 w-[160px] animate-pulse rounded-md bg-[--bg-muted]" />
            </div>
          </div>
        </div>
        
        <EventGridSkeleton count={8} />
      </div>
    </SectionContainer>
  )
}
