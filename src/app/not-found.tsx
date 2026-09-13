import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Page Not Found — ${APP_NAME}`,
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[--bg-base] px-4">
      <div className="w-full max-w-md text-center">
        {/* Large 404 */}
        <p
          className="font-display text-[8rem] font-bold leading-none tracking-tighter text-[--border-default] select-none md:text-[10rem]"
          aria-hidden="true"
        >
          404
        </p>

        {/* Icon */}
        <div className="mx-auto mb-6 -mt-4 flex h-16 w-16 items-center justify-center">
          <Image
            src="/logo-icon.png"
            alt="CampusLoop Logo"
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
        </div>

        <h1 className="font-display text-2xl font-bold text-[--text-primary]">
          Page not found
        </h1>
        <p className="mt-3 text-[--text-muted]">
          We couldn&apos;t find the page you&apos;re looking for. It may have been moved, deleted, or the URL might be incorrect.
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="w-full rounded-lg bg-[--accent-500] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[--accent-600] sm:w-auto"
          >
            Go home
          </Link>
          <Link
            href="/events"
            className="w-full rounded-lg border border-[--border-default] px-6 py-2.5 text-sm font-semibold text-[--text-secondary] transition-colors hover:border-[--border-strong] hover:text-[--text-primary] sm:w-auto"
          >
            Browse Events
          </Link>
        </div>
      </div>
    </div>
  )
}
