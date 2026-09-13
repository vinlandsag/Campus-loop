'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Flag,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { adminUpdateReport } from '@/app/actions/admin.actions'
import type { ModerationReport, ModerationReportStatus } from '@/types'

interface ReportManagementClientProps {
  initialReports: ModerationReport[]
}

type TabStatus = 'all' | ModerationReportStatus

export function ReportManagementClient({ initialReports }: ReportManagementClientProps) {
  const router = useRouter()
  const [reports, setReports] = useState<ModerationReport[]>(initialReports)
  const [activeTab, setActiveTab] = useState<TabStatus>('pending')

  // Review modal state
  const [reviewModal, setReviewModal] = useState<{
    report: ModerationReport
    action: 'dismiss' | 'investigate' | 'action_taken'
  } | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const filteredReports = reports.filter((r) => {
    if (activeTab === 'all') return true
    return r.status === activeTab
  })

  const counts = {
    all: reports.length,
    pending: reports.filter((r) => r.status === 'pending').length,
    investigating: reports.filter((r) => r.status === 'investigating').length,
    action_taken: reports.filter((r) => r.status === 'action_taken').length,
    dismissed: reports.filter((r) => r.status === 'dismissed').length,
  }

  async function handleConfirmReview() {
    if (!reviewModal) return
    const { report, action } = reviewModal
    setIsSubmitting(true)

    try {
      const result = await adminUpdateReport(report.id, action, adminNotes)
      if (result.success && result.data) {
        toast.success(`Report marked as ${result.data.status.replace('_', ' ')}`)
        setReports((prev) =>
          prev.map((r) => (r.id === report.id ? result.data! : r))
        )
        setReviewModal(null)
        setAdminNotes('')
        router.refresh()
      } else {
        toast.error('Failed to update report', { description: !result.success ? result.error : undefined })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
          Moderation Reports
        </h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Review reported events, suspicious organizers, and abusive content submitted by the campus community.
        </p>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap rounded-lg border border-[--border-subtle] bg-[--bg-surface] p-1">
        <TabItem
          label="Pending"
          count={counts.pending}
          active={activeTab === 'pending'}
          badge="amber"
          onClick={() => setActiveTab('pending')}
        />
        <TabItem
          label="Investigating"
          count={counts.investigating}
          active={activeTab === 'investigating'}
          badge="blue"
          onClick={() => setActiveTab('investigating')}
        />
        <TabItem
          label="Action Taken"
          count={counts.action_taken}
          active={activeTab === 'action_taken'}
          badge="green"
          onClick={() => setActiveTab('action_taken')}
        />
        <TabItem
          label="Dismissed"
          count={counts.dismissed}
          active={activeTab === 'dismissed'}
          onClick={() => setActiveTab('dismissed')}
        />
        <TabItem
          label="All"
          count={counts.all}
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
        />
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
          <Flag className="h-10 w-10 text-[--text-muted]" />
          <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">No reports found</h3>
          <p className="mt-1 text-xs text-[--text-muted]">
            {activeTab === 'pending'
              ? 'Great news! No reports are currently awaiting moderation review.'
              : 'No moderation reports match this status.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]">
          <div className="divide-y divide-[--border-subtle]">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-[--bg-subtle]"
              >
                {/* Top: Badges and Date */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                      {report.target_type}
                    </span>
                    <span className="text-xs font-semibold text-[--text-primary]">
                      Reason: {report.reason.replace(/_/g, ' ')}
                    </span>
                    <StatusBadge status={report.status} />
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-[--text-muted]" suppressHydrationWarning>
                    <Clock className="h-3 w-3" />
                    {(() => {
                      try {
                        return format(parseISO(report.created_at), 'MMM d, yyyy, h:mm a')
                      } catch {
                        return report.created_at
                      }
                    })()}
                  </span>
                </div>

                {/* Details & Target ID */}
                <div className="text-xs text-[--text-secondary]">
                  {report.details ? (
                    <div className="rounded-lg bg-[--bg-base] p-3">
                      <p className="font-medium text-[--text-primary]">Reporter Details:</p>
                      <p className="mt-1 text-[--text-secondary]">{report.details}</p>
                    </div>
                  ) : (
                    <p className="italic text-[--text-muted]">No extra details provided by reporter.</p>
                  )}

                  <div className="mt-2 flex items-center gap-2 text-[11px] text-[--text-muted]">
                    <span>Target ID:</span>
                    <code className="rounded bg-[--bg-muted] px-1 py-0.5 font-mono">
                      {report.target_id}
                    </code>
                    {report.target_type === 'event' && (
                      <Link
                        href={`/admin/events`}
                        className="inline-flex items-center gap-0.5 text-amber-600 hover:underline"
                      >
                        Find in Events <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                    {report.target_type === 'organizer' && (
                      <Link
                        href={`/admin/organizers`}
                        className="inline-flex items-center gap-0.5 text-amber-600 hover:underline"
                      >
                        Find in Organizers <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    )}
                  </div>

                  {report.admin_notes && (
                    <div className="mt-2 rounded-lg border border-amber-200/50 bg-amber-50/50 p-2.5 text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/30 dark:text-amber-300">
                      <p className="font-semibold text-[11px]">Moderator Notes:</p>
                      <p className="mt-0.5">{report.admin_notes}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {report.status !== 'investigating' && (
                    <button
                      onClick={() => setReviewModal({ report, action: 'investigate' })}
                      className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Investigate
                    </button>
                  )}

                  {report.status !== 'action_taken' && (
                    <button
                      onClick={() => setReviewModal({ report, action: 'action_taken' })}
                      className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                    >
                      <CheckCircle className="h-3 w-3" />
                      Action Taken
                    </button>
                  )}

                  {report.status !== 'dismissed' && (
                    <button
                      onClick={() => setReviewModal({ report, action: 'dismiss' })}
                      className="flex items-center gap-1 rounded-md border border-[--border-subtle] px-2.5 py-1 text-xs font-semibold text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary]"
                    >
                      <XCircle className="h-3 w-3" />
                      Dismiss
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl">
            <h3 className="font-display text-base font-bold text-[--text-primary]">
              {reviewModal.action === 'investigate' && 'Mark Under Investigation'}
              {reviewModal.action === 'action_taken' && 'Mark Action Taken'}
              {reviewModal.action === 'dismiss' && 'Dismiss Moderation Report'}
            </h3>

            <p className="mt-1 text-xs text-[--text-secondary]">
              Update report status and optionally record notes for the audit trail.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-[--text-secondary]">
                Moderator Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="e.g. Contacted organizer; warning issued regarding campus policies."
                rows={3}
                className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-xs text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                disabled={isSubmitting}
                className="rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReview}
                disabled={isSubmitting}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-50 ${
                  reviewModal.action === 'action_taken'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : reviewModal.action === 'investigate'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isSubmitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Confirm Status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabItem({
  label,
  count,
  active,
  badge,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  badge?: 'amber' | 'blue' | 'green'
  onClick: () => void
}) {
  const badgeColors = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[--bg-muted] text-[--text-primary] shadow-xs'
          : 'text-[--text-muted] hover:text-[--text-primary]'
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
          badge && badgeColors[badge]
            ? badgeColors[badge]
            : 'bg-[--bg-subtle] text-[--text-muted]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function StatusBadge({ status }: { status: ModerationReportStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Pending Review
        </span>
      )
    case 'investigating':
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
          Investigating
        </span>
      )
    case 'action_taken':
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Action Taken
        </span>
      )
    case 'dismissed':
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Dismissed
        </span>
      )
  }
}
