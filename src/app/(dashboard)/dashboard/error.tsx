'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DashboardErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error('Dashboard error caught by boundary:', error)
  }, [error])

  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
        <AlertTriangle className="h-8 w-8" />
      </div>

      <h2 className="mt-6 font-display text-2xl font-bold tracking-tight text-[--text-primary]">
        Unable to load organizer dashboard
      </h2>

      <p className="mt-2 max-w-md text-sm text-[--text-secondary] leading-relaxed">
        {error.message ||
          'We encountered an unexpected issue while loading your organizer workspace. Please try again or return to the main events feed.'}
      </p>

      {error.digest && (
        <p className="mt-2 font-mono text-xs text-[--text-muted]">
          Reference ID: {error.digest}
        </p>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          <span>Try Again</span>
        </Button>
        <Link
          href="/events"
          className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}
        >
          <Home className="h-4 w-4" />
          <span>Browse Events</span>
        </Link>
      </div>
    </div>
  )
}
