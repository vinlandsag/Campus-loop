'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Download,
  Trash2,
  Award,
  Calendar,
  AlertTriangle,
  ExternalLink,
  Shield,
  LifeBuoy,
  XCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  exportPersonalData,
  requestAccountDeletion,
  cancelAccountDeletion,
} from '@/app/actions/settings.actions'
import type { AccountDeletionRequest } from '@/types'

interface DataTabProps {
  initialDeletionRequest: AccountDeletionRequest | null
}

export function DataTab({ initialDeletionRequest }: DataTabProps) {
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(
    initialDeletionRequest
  )
  const [isExporting, setIsExporting] = useState(false)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [deletionReason, setDeletionReason] = useState('')
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isCancelling, startCancelTransition] = useTransition()

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const res = await exportPersonalData()
      if (res.success && res.data) {
        const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
          JSON.stringify(res.data, null, 2)
        )}`
        const downloadAnchor = document.createElement('a')
        downloadAnchor.setAttribute('href', jsonString)
        downloadAnchor.setAttribute(
          'download',
          `campusloop-personal-data-${new Date().toISOString().split('T')[0]}.json`
        )
        document.body.appendChild(downloadAnchor)
        downloadAnchor.click()
        downloadAnchor.remove()

        toast.success('Personal data export downloaded successfully!')
      } else {
        toast.error(res.error || 'Failed to generate personal data export.')
      }
    } catch {
      toast.error('Export generation error.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleRequestDeletion = (e: React.FormEvent) => {
    e.preventDefault()

    if (confirmationInput.trim() !== 'DELETE MY ACCOUNT') {
      toast.error('Please enter "DELETE MY ACCOUNT" exactly to confirm.')
      return
    }

    startDeleteTransition(async () => {
      const res = await requestAccountDeletion(confirmationInput, deletionReason)
      if (res.success && res.scheduledFor) {
        setDeletionRequest({
          id: 'temp',
          user_id: 'me',
          status: 'scheduled',
          scheduled_for: res.scheduledFor,
          reason: deletionReason,
          created_at: new Date().toISOString(),
        })
        setConfirmationInput('')
        setDeletionReason('')
        toast.warning('Account deletion scheduled. You have 14 days to cancel if you change your mind.')
      } else {
        toast.error(res.error || 'Failed to schedule account deletion.')
      }
    })
  }

  const handleCancelDeletion = () => {
    startCancelTransition(async () => {
      const res = await cancelAccountDeletion()
      if (res.success) {
        setDeletionRequest(null)
        toast.success('Account deletion has been cancelled. Your account remains active.')
      } else {
        toast.error(res.error || 'Failed to cancel deletion.')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Personal Data &amp; Account Lifecycle
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Download copies of your campus records, view compliance certificates, and manage account closure.
        </p>
      </div>

      {/* Data Export Card */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
              <Download className="h-4 w-4 text-emerald-600" />
              Download Personal Data Archive
            </h3>
            <p className="text-xs text-[--text-secondary] max-w-lg leading-relaxed">
              Export an institutional GDPR/FERPA-compliant JSON package containing your complete registration history, ticket codes, verified certificates, and audit logs.
            </p>
          </div>

          <Button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            size="sm"
            className="gap-2 shrink-0 self-start"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download JSON Archive
          </Button>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[--border-subtle]">
          <Link
            href="/my-events"
            className="flex items-center justify-between p-3 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/20 hover:bg-[--bg-muted]/50 text-xs transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-[--text-primary]">
              <Calendar className="h-4 w-4 text-blue-600" />
              View Registration History
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-[--text-muted]" />
          </Link>

          <Link
            href="/my-events"
            className="flex items-center justify-between p-3 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/20 hover:bg-[--bg-muted]/50 text-xs transition-colors"
          >
            <span className="flex items-center gap-2 font-medium text-[--text-primary]">
              <Award className="h-4 w-4 text-amber-600" />
              View Verified Certificates
            </span>
            <ExternalLink className="h-3.5 w-3.5 text-[--text-muted]" />
          </Link>
        </div>
      </div>

      {/* Account Deletion Section */}
      <div className="rounded-2xl border border-red-500/30 bg-red-50/10 dark:bg-red-950/10 p-5 sm:p-6 space-y-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Account
            </h3>
            <p className="text-xs text-[--text-secondary] mt-0.5">
              Permanently close your account, invalidate registrations, and remove your identity from public campus feeds.
            </p>
          </div>
          <Badge variant="outline" className="border-red-300 text-red-600 dark:border-red-900/60 dark:text-red-400 text-[10px]">
            Irreversible
          </Badge>
        </div>

        {deletionRequest ? (
          <div className="rounded-xl border border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-red-900 dark:text-red-200 flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Account Deletion Scheduled
              </span>
              <Badge variant="default" className="bg-red-600 text-white text-[10px]">
                14-Day Grace Period
              </Badge>
            </div>
            <p className="text-xs text-red-800 dark:text-red-300 leading-relaxed">
              Your account is scheduled for permanent purge on{' '}
              <strong>{new Date(deletionRequest.scheduled_for).toLocaleDateString()}</strong>. You can cancel this request at any time prior to that date to keep your registrations intact.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancelDeletion}
              disabled={isCancelling}
              className="border-red-400 text-red-700 hover:bg-red-100 dark:hover:bg-red-950/50 text-xs gap-1.5"
            >
              {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Cancel Scheduled Deletion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleRequestDeletion} className="space-y-4 max-w-lg">
            <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 text-xs text-[--text-secondary] space-y-2 leading-relaxed">
              <p className="font-semibold text-[--text-primary]">Important Deletion Policies:</p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-[--text-muted]">
                <li>Active ticket QR passes and check-in eligibility will be cancelled immediately.</li>
                <li>Your contact card and friend relationships will be severed.</li>
                <li>Completed historical aggregate counts remain anonymous for campus activity statistics.</li>
                <li>A 14-day grace period is provided during which you can cancel your request.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm_deletion" className="text-xs text-red-600 dark:text-red-400 font-semibold">
                Type &ldquo;DELETE MY ACCOUNT&rdquo; to confirm:
              </Label>
              <Input
                id="confirm_deletion"
                value={confirmationInput}
                onChange={(e) => setConfirmationInput(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                required
                className="text-xs border-red-300 focus:border-red-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="deletion_reason" className="text-xs">
                Reason for leaving (Optional)
              </Label>
              <textarea
                id="deletion_reason"
                rows={2}
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="e.g. Graduated, transferred to another university..."
                className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary]"
              />
            </div>

            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={confirmationInput.trim() !== 'DELETE MY ACCOUNT' || isDeleting}
              className="gap-2 text-xs"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Schedule Account Deletion (14-Day Window)
            </Button>
          </form>
        )}
      </div>

      {/* Safety & Legal Resources */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          Campus Resources &amp; Legal Notices
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <Link
            href="/privacy"
            className="p-3 rounded-xl border border-[--border-subtle] hover:bg-[--bg-muted]/40 font-medium text-[--text-secondary] flex items-center justify-between"
          >
            <span>Privacy Policy</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
          <Link
            href="/terms"
            className="p-3 rounded-xl border border-[--border-subtle] hover:bg-[--bg-muted]/40 font-medium text-[--text-secondary] flex items-center justify-between"
          >
            <span>Terms of Use</span>
            <ExternalLink className="h-3 w-3 opacity-50" />
          </Link>
          <Link
            href="/support"
            className="p-3 rounded-xl border border-[--border-subtle] hover:bg-[--bg-muted]/40 font-medium text-[--text-secondary] flex items-center justify-between"
          >
            <span>Support Desk</span>
            <LifeBuoy className="h-3 w-3 opacity-50" />
          </Link>
          <Link
            href="/safety"
            className="p-3 rounded-xl border border-[--border-subtle] hover:bg-[--bg-muted]/40 font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between"
          >
            <span>Report Safety Issue</span>
            <Shield className="h-3 w-3 opacity-50" />
          </Link>
        </div>
      </div>
    </div>
  )
}
