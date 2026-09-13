import Image from 'next/image'
import Link from 'next/link'
import { APP_NAME } from '@/lib/constants'

interface AuthFormProps {
  title: string
  description: string
  children: React.ReactNode
  type: 'login' | 'signup'
  next?: string | null
}

export function AuthForm({ title, description, children, type, next }: AuthFormProps) {
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5 font-display text-2xl font-bold tracking-tight transition-opacity hover:opacity-85"
            aria-label={`${APP_NAME} — home`}
          >
            <Image
              src="/logo-icon.png"
              alt="CampusLoop Logo"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              priority
            />
            <span className="text-[--text-primary]">
              Campus<span className="text-[--accent-500]">Loop</span>
            </span>
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold text-[--text-primary]">
            {title}
          </h1>
          <p className="mt-1 text-sm text-[--text-muted]">{description}</p>
        </div>

        {/* Form Container */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-[--shadow-sm]">
          {children}
        </div>

        {/* Footer */}
        <p className="mt-4 text-center text-sm text-[--text-muted]">
          {type === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <Link
                href={safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : '/signup'}
                className="font-medium text-[--text-primary] hover:underline"
              >
                Sign up
              </Link>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <Link
                href={safeNext ? `/login?next=${encodeURIComponent(safeNext)}` : '/login'}
                className="font-medium text-[--text-primary] hover:underline"
              >
                Sign in
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
