import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { isSystemAdmin } from '@/lib/auth/admin'
import { getModerationReports, getPendingOrganizers } from '@/app/actions/moderation.actions'
import { ModerationAdminTabs } from '@/components/dashboard/ModerationAdminTabs'

export default async function AdminModerationPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const isAdmin = await isSystemAdmin(supabase, user)
  if (!isAdmin) {
    redirect('/dashboard')
  }

  const [reportsResult, organizersResult] = await Promise.all([
    getModerationReports(),
    getPendingOrganizers(),
  ])

  const reports = reportsResult.success ? reportsResult.data : []
  const pendingOrganizers = organizersResult.success ? organizersResult.data : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[--text-secondary] transition-colors hover:text-[--text-primary] mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-2.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
              Admin Moderation & Approval Portal
            </h1>
            <p className="mt-1 text-sm text-[--text-secondary]">
              Review club organizer verification requests and investigate student safety/moderation reports.
            </p>
          </div>
        </div>
      </div>

      <ModerationAdminTabs
        initialReports={reports}
        initialOrganizers={pendingOrganizers}
      />
    </div>
  )
}
