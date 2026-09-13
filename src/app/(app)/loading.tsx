import { Skeleton } from '@/components/ui/skeleton'

export default function AppLoading() {
  return (
    <div className="container-page space-y-8 py-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded-lg bg-[--bg-muted]" />
        <Skeleton className="h-4 w-72 rounded-md bg-[--bg-muted]" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-3 border-b border-[--border-subtle] pb-3">
        <Skeleton className="h-9 w-28 rounded-lg bg-[--bg-muted]" />
        <Skeleton className="h-9 w-28 rounded-lg bg-[--bg-muted]" />
        <Skeleton className="h-9 w-28 rounded-lg bg-[--bg-muted]" />
      </div>

      {/* Event Cards Grid Skeleton */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm"
          >
            <Skeleton className="aspect-video w-full bg-[--bg-muted]" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/4 rounded bg-[--bg-muted]" />
              <Skeleton className="h-4 w-1/2 rounded bg-[--bg-muted]" />
              <div className="pt-2 flex justify-between">
                <Skeleton className="h-4 w-20 rounded bg-[--bg-muted]" />
                <Skeleton className="h-4 w-16 rounded bg-[--bg-muted]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
