import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="container-page space-y-8 py-8 animate-pulse">
      {/* Top Header Skeleton */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg bg-[--bg-muted]" />
          <Skeleton className="h-4 w-72 rounded-md bg-[--bg-muted]" />
        </div>
        <Skeleton className="h-10 w-36 rounded-xl bg-[--bg-muted]" />
      </div>

      {/* KPI Metric Cards Skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 space-y-3 shadow-sm"
          >
            <Skeleton className="h-4 w-20 rounded bg-[--bg-muted]" />
            <Skeleton className="h-8 w-14 rounded-lg bg-[--bg-muted]" />
            <Skeleton className="h-3 w-28 rounded bg-[--bg-muted]" />
          </div>
        ))}
      </div>

      {/* Events Table / Grid Skeleton */}
      <div className="space-y-4 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center justify-between border-b border-[--border-subtle] pb-4">
          <Skeleton className="h-6 w-32 rounded bg-[--bg-muted]" />
          <Skeleton className="h-4 w-20 rounded bg-[--bg-muted]" />
        </div>
        <div className="space-y-3 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-4 rounded-xl border border-[--border-subtle] p-4"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-xl bg-[--bg-muted]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-44 rounded bg-[--bg-muted]" />
                  <Skeleton className="h-3 w-28 rounded bg-[--bg-muted]" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-8 w-20 rounded-lg bg-[--bg-muted]" />
                <Skeleton className="h-8 w-8 rounded-lg bg-[--bg-muted]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
