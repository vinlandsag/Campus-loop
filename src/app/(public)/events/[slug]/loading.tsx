import { Skeleton } from '@/components/ui/skeleton'

export default function EventDetailLoading() {
  return (
    <div className="min-h-screen pb-16 animate-pulse">
      {/* Banner Skeleton */}
      <div className="relative aspect-[21/9] w-full max-h-[440px] min-h-[240px] bg-[--bg-muted]" />

      <div className="container-page mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* Main Content Skeleton */}
        <div className="space-y-8 lg:col-span-2">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full bg-[--bg-muted]" />
              <Skeleton className="h-6 w-28 rounded-full bg-[--bg-muted]" />
            </div>
            <Skeleton className="h-10 w-3/4 rounded-xl bg-[--bg-muted]" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full bg-[--bg-muted]" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded bg-[--bg-muted]" />
                <Skeleton className="h-3 w-20 rounded bg-[--bg-muted]" />
              </div>
            </div>
          </div>

          {/* Description Skeleton */}
          <div className="space-y-3 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6">
            <Skeleton className="h-5 w-28 rounded bg-[--bg-muted]" />
            <Skeleton className="h-4 w-full rounded bg-[--bg-muted]" />
            <Skeleton className="h-4 w-full rounded bg-[--bg-muted]" />
            <Skeleton className="h-4 w-2/3 rounded bg-[--bg-muted]" />
          </div>

          {/* Agenda Timeline Skeleton */}
          <div className="space-y-3 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6">
            <Skeleton className="h-5 w-36 rounded bg-[--bg-muted]" />
            <div className="space-y-4 pt-2">
              <Skeleton className="h-12 w-full rounded-xl bg-[--bg-muted]" />
              <Skeleton className="h-12 w-full rounded-xl bg-[--bg-muted]" />
            </div>
          </div>
        </div>

        {/* Sidebar Action Card Skeleton */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 space-y-5 shadow-sm">
            <div className="space-y-3">
              <Skeleton className="h-4 w-full rounded bg-[--bg-muted]" />
              <Skeleton className="h-4 w-3/4 rounded bg-[--bg-muted]" />
              <Skeleton className="h-4 w-1/2 rounded bg-[--bg-muted]" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl bg-[--bg-muted]" />
            <Skeleton className="h-9 w-full rounded-xl bg-[--bg-muted]" />
          </div>
        </div>
      </div>
    </div>
  )
}
