import Link from 'next/link'
import {
  Users,
  GraduationCap,
  Calendar,
  Flag,
  ScrollText,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react'
import { adminGetDashboardOverview } from '@/app/actions/admin.actions'

export default async function AdminOverviewPage() {
  const result = await adminGetDashboardOverview()
  const data = result.success ? result.data : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Overview of platform moderation, organizer approvals, and campus management.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Pending Approvals"
          value={data?.pendingOrganizers ?? 0}
          icon={Users}
          href="/admin/organizers"
          accent={data?.pendingOrganizers ? 'warning' : 'default'}
        />
        <StatCard
          title="Pending Reports"
          value={data?.pendingReports ?? 0}
          icon={Flag}
          href="/admin/reports"
          accent={data?.pendingReports ? 'danger' : 'default'}
        />
        <StatCard
          title="Under Investigation"
          value={data?.flaggedEvents ?? 0}
          icon={AlertTriangle}
          href="/admin/reports"
          accent={data?.flaggedEvents ? 'warning' : 'default'}
        />
        <StatCard
          title="Active Campuses"
          value={`${data?.activeCampuses ?? 0} / ${data?.totalCampuses ?? 0}`}
          icon={GraduationCap}
          href="/admin/colleges"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickAction
          title="Review Organizer Requests"
          description={`${data?.pendingOrganizers ?? 0} pending approvals`}
          href="/admin/organizers"
          icon={Users}
        />
        <QuickAction
          title="Manage Colleges & Domains"
          description={`${data?.totalCampuses ?? 0} campuses configured`}
          href="/admin/colleges"
          icon={GraduationCap}
        />
        <QuickAction
          title="Event Oversight"
          description={`${data?.totalEvents ?? 0} total events`}
          href="/admin/events"
          icon={Calendar}
        />
        <QuickAction
          title="Moderation Reports"
          description={`${data?.pendingReports ?? 0} reports awaiting review`}
          href="/admin/reports"
          icon={Flag}
        />
        <QuickAction
          title="Audit Log"
          description={`${data?.recentAuditCount ?? 0} total entries`}
          href="/admin/audit"
          icon={ScrollText}
        />
      </div>
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  accent = 'default',
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  href: string
  accent?: 'default' | 'warning' | 'danger'
}) {
  const accentStyles = {
    default: 'bg-[--bg-muted] text-[--text-secondary]',
    warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400',
    danger: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400',
  }

  return (
    <Link
      href={href}
      className="group rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-5 transition-all hover:border-[--border-default] hover:shadow-md"
    >
      <div className="flex items-center justify-between">
        <div className={`rounded-lg p-2 ${accentStyles[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-[--text-muted] transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-2xl font-bold text-[--text-primary]">{value}</p>
      <p className="text-sm text-[--text-secondary]">{title}</p>
    </Link>
  )
}

function QuickAction({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 transition-all hover:border-[--border-default] hover:shadow-sm"
    >
      <div className="rounded-lg bg-amber-50 p-2.5 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[--text-primary]">{title}</p>
        <p className="text-xs text-[--text-muted]">{description}</p>
      </div>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-[--text-muted] transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
