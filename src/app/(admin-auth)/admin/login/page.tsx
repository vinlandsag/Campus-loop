import { Suspense } from 'react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import { APP_NAME } from '@/lib/constants'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export const metadata: Metadata = {
  title: `Admin Login — ${APP_NAME}`,
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage() {
  // If already logged in as admin, redirect to admin dashboard
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const isAdmin = await isSystemAdmin(supabase, user)
    if (isAdmin) {
      redirect('/admin')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[--bg-base] px-4 py-16">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
            <Shield className="h-8 w-8" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary]">
            {APP_NAME} Admin
          </h1>
          <p className="mt-1 text-sm text-[--text-muted]">
            Sign in with your administrator account
          </p>
        </div>

        {/* Login Form */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-[--shadow-sm]">
          <Suspense
            fallback={<div className="h-48 animate-pulse rounded-lg bg-[--bg-muted]" />}
          >
            <AdminLoginForm />
          </Suspense>
        </div>

        <p className="mt-4 text-center text-xs text-[--text-muted]">
          This portal is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  )
}
