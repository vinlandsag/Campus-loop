import { Skeleton } from '@/components/ui/skeleton'

export default function OrganizerProfileLoading() {
  return (
    <div className="min-h-screen pb-16 animate-pulse">
      <div className="container-page py-10 space-y-10">
        {/* Profile Header Skeleton */}
        <div className="rounded-3xl border border-[--border-subtle] bg-[--bg-surface] p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-2xl bg-[--bg-muted]" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-8 w-60 rounded-xl bg-[--bg-muted]" />
              <Skeleton className="h-4 w-40 rounded-md bg-[--bg-muted]" />
              <Skeleton className="h-4 w-3/4 rounded-md bg-[--bg-muted]" />
            </div>
          </div>

          {/* Impact Stats Skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-[--border-subtle]">
            <Skeleton className="h-14 rounded-xl bg-[--bg-muted]" />
            <Skeleton className="h-14 rounded-xl bg-[--bg-muted]" />
            <Skeleton className="h-14 rounded-xl bg-[--bg-muted]" />
          </div>
        </div>

        {/* Upcoming Events Grid Skeleton */}
        <div className="space-y-6">
          <Skeleton className="h-7 w-48 rounded-lg bg-[--bg-muted]" />
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm"
              >
                <Skeleton className="aspect-video w-full bg-[--bg-muted]" />
                <div className="p-5 space-y-3">
                  <Skeleton className="h-5 w-3/4 rounded bg-[--bg-muted]" />
                  <Skeleton className="h-4 w-1/2 rounded bg-[--bg-muted]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
