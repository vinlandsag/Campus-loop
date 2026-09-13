'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  Eye,
  Shield,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateModerationReportStatus } from '@/app/actions/moderation.actions'
import type { ModerationReport, ModerationReportStatus } from '@/types'

interface ModerationQueueClientProps {
  initialReports: ModerationReport[]
}

export function ModerationQueueClient({ initialReports }: ModerationQueueClientProps) {
  const [reports, setReports] = useState<ModerationReport[]>(initialReports)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleUpdateStatus = (reportId: string, status: ModerationReportStatus) => {
    startTransition(async () => {
      const result = await updateModerationReportStatus({
        reportId,
        status,
        adminNotes: adminNotes || undefined,
      })

      if (result.success) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? result.data : r))
        )
        if (selectedReport?.id === reportId) {
          setSelectedReport(result.data)
        }
        toast.success(`Report status updated to "${status}".`)
      } else {
        toast.error(result.error || 'Failed to update report status.')
      }
    })
  }

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'all') return true
    return r.status === filterStatus
  })

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[--border-subtle]">
        {['all', 'pending', 'investigating', 'action_taken', 'dismissed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
              filterStatus === status
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                : 'bg-[--bg-muted] text-[--text-secondary] hover:text-[--text-primary]'
            }`}
          >
            {status.replace(/_/g, ' ')}{' '}
            <span className="ml-1 opacity-70">
              ({status === 'all' ? reports.length : reports.filter((r) => r.status === status).length})
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports List */}
        <div className="lg:col-span-2 space-y-3">
          {filteredReports.length === 0 ? (
            <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
              <Shield className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
              <h3 className="font-display text-base font-bold text-[--text-primary]">
                Queue is Clear
              </h3>
              <p className="mt-1 text-xs text-[--text-secondary]">
                No moderation reports matching the selected filter.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  setSelectedReport(report)
                  setAdminNotes(report.admin_notes || '')
                }}
                className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                  selectedReport?.id === report.id
                    ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm'
                    : 'border-[--border-subtle] bg-[--bg-surface] hover:border-[--border-default]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs uppercase tracking-wider text-[--text-muted]">
                        {report.target_type} report
                      </span>
                      <Badge
                        variant={
                          report.status === 'pending'
                            ? 'default'
                            : report.status === 'action_taken'
                              ? 'destructive'
                              : 'secondary'
                        }
                        className="text-[10px] capitalize"
                      >
                        {report.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    <h4 className="font-bold text-sm text-[--text-primary] capitalize">
                      Reason: {report.reason.replace(/_/g, ' ')}
                    </h4>

                    {report.details && (
                      <p className="text-xs text-[--text-secondary] line-clamp-2 mt-1">
                        &ldquo;{report.details}&rdquo;
                      </p>
                    )}
                  </div>

                  <span className="text-[10px] text-[--text-muted] whitespace-nowrap">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Report Inspection & Action Drawer */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm h-fit space-y-5">
          <div className="border-b border-[--border-subtle] pb-4">
            <h3 className="font-display text-base font-bold text-[--text-primary] flex items-center gap-2">
              <Eye className="h-4 w-4 text-emerald-600" />
              Report Details
            </h3>
          </div>

          {!selectedReport ? (
            <p className="text-xs text-[--text-muted] text-center py-8">
              Select a moderation report to inspect evidence and apply moderation actions.
            </p>
          ) : (
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[11px] text-[--text-muted]">Target Type:</span>
                <p className="font-semibold capitalize text-[--text-primary]">{selectedReport.target_type}</p>
              </div>

              <div>
                <span className="text-[11px] text-[--text-muted]">Target Identifier:</span>
                <p className="font-mono text-[11px] text-[--text-secondary] break-all">{selectedReport.target_id}</p>
              </div>

              <div>
                <span className="text-[11px] text-[--text-muted]">Report Reason:</span>
                <p className="font-semibold capitalize text-rose-600 dark:text-rose-400">
                  {selectedReport.reason.replace(/_/g, ' ')}
                </p>
              </div>

              {selectedReport.details && (
                <div>
                  <span className="text-[11px] text-[--text-muted]">Reporter Details:</span>
                  <div className="mt-1 rounded-lg bg-[--bg-muted] p-3 text-xs italic text-[--text-primary]">
                    &ldquo;{selectedReport.details}&rdquo;
                  </div>
                </div>
              )}

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-[--text-primary]">
                  Admin Resolution Notes
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Notes on review actions or findings..."
                  className="w-full rounded-xl border border-[--border-subtle] bg-[--bg-default] px-3 py-2 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-emerald-500 focus:outline-none resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending || selectedReport.status === 'investigating'}
                    onClick={() => handleUpdateStatus(selectedReport.id, 'investigating')}
                    className="text-xs"
                  >
                    Investigating
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending || selectedReport.status === 'dismissed'}
                    onClick={() => handleUpdateStatus(selectedReport.id, 'dismissed')}
                    className="text-xs text-zinc-500 hover:text-zinc-700"
                  >
                    Dismiss
                  </Button>
                </div>

                <Button
                  size="sm"
                  disabled={isPending || selectedReport.status === 'action_taken'}
                  onClick={() => handleUpdateStatus(selectedReport.id, 'action_taken')}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Take Action (Resolve)
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
