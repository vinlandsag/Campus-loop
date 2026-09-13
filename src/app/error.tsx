'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { APP_NAME } from '@/lib/constants'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Root error boundary.
 * Must be a Client Component because it uses the `reset` callback.
 */
export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service in production
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[--bg-base] px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-red-100">
          <AlertTriangle className="h-7 w-7 text-red-600" aria-hidden="true" />
        </div>

        <h1 className="font-display text-2xl font-bold text-[--text-primary]">
          Something went wrong
        </h1>
        <p className="mt-3 text-[--text-muted]">
          An unexpected error occurred. If the problem persists, please contact support.
        </p>

        {/* Error digest for debugging — hidden in production */}
        {error.digest && process.env['NODE_ENV'] === 'development' && (
          <p className="mt-3 rounded-md bg-[--bg-muted] px-3 py-2 font-mono text-xs text-[--text-muted]">
            Digest: {error.digest}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[--accent-500] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[--accent-600] sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="w-full rounded-lg border border-[--border-default] px-6 py-2.5 text-center text-sm font-semibold text-[--text-secondary] transition-colors hover:border-[--border-strong] hover:text-[--text-primary] sm:w-auto"
          >
            Go home
          </Link>
        </div>
      </div>
      <p className="mt-8 text-xs text-[--text-disabled]">{APP_NAME}</p>
    </div>
  )
}
