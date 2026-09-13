'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { X, Flag, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { submitModerationReport } from '@/app/actions/moderation.actions'
import type { ModerationTargetType, ModerationReportReason } from '@/types'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetType: ModerationTargetType
  targetId: string
  targetTitle: string
}

export function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}: ReportModalProps) {
  const [reason, setReason] = useState<ModerationReportReason>('spam')
  const [details, setDetails] = useState('')
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await submitModerationReport({
        targetType,
        targetId,
        reason,
        details,
      })

      if (result.success) {
        toast.success(`Thank you. Your report has been submitted to campus moderators.`)
        onClose()
      } else {
        toast.error(result.error || 'Failed to submit report.')
      }
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[--border-subtle] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-rose-100 p-2 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <Flag className="h-5 w-5" />
            </div>
            <div>
              <h2 id="report-modal-title" className="font-display text-base font-bold text-[--text-primary]">
                Report {targetType === 'event' ? 'Event' : 'Organizer'}
              </h2>
              <p className="text-xs text-[--text-secondary] truncate max-w-xs">{targetTitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[--text-primary]">
              Reason for report
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ModerationReportReason)}
              className="w-full rounded-xl border border-[--border-subtle] bg-[--bg-default] px-3.5 py-2.5 text-xs text-[--text-primary] focus:border-rose-500 focus:outline-none"
            >
              <option value="spam">Spam or commercial advertising</option>
              <option value="misleading">Misleading or fraudulent information</option>
              <option value="safety_concern">Safety, security, or code of conduct violation</option>
              <option value="fraud">Impersonation or unauthorized activity</option>
              <option value="inappropriate">Inappropriate or offensive content</option>
              <option value="harassment">Harassment or bullying</option>
              <option value="other">Other reason</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[--text-primary]">
              Additional details (optional)
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide any additional context for campus moderators..."
              className="w-full rounded-xl border border-[--border-subtle] bg-[--bg-default] px-3.5 py-2.5 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-rose-500 focus:outline-none resize-none"
            />
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/70 p-3 text-[11px] text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>
              Reports are taken seriously and reviewed by verified campus administrators. False or abusive reporting is strictly tracked.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPending ? 'Submitting...' : 'Submit Report'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
