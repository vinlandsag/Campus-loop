'use client'

import { useState, useTransition } from 'react'
import {
  MapPin,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Mail,
  ArrowRight,
  Info,
  Loader2,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  checkCampusChangeImpact,
  requestCampusTransfer,
} from '@/app/actions/settings.actions'
import type { Campus, CampusVerificationStatus } from '@/types'

interface CampusTabProps {
  currentCampus: Campus | null
  campusStatus: CampusVerificationStatus
  pendingCampus: Campus | null
  exceptionReason: string | null
  verifiedAt: string | null
  campuses: Campus[]
  userEmail: string
  isOrganizer: boolean
}

export function CampusTab({
  currentCampus,
  campusStatus,
  pendingCampus,
  exceptionReason,
  campuses,
  userEmail,
  isOrganizer,
}: CampusTabProps) {
  const [selectedCampusId, setSelectedCampusId] = useState('')
  const [transferReason, setTransferReason] = useState('')
  const [impactWarning, setImpactWarning] = useState<string | null>(null)
  const [checkingImpact, setCheckingImpact] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleSelectCampus = async (campusId: string) => {
    setSelectedCampusId(campusId)
    setImpactWarning(null)

    if (!campusId || campusId === currentCampus?.id) return

    setCheckingImpact(true)
    try {
      const res = await checkCampusChangeImpact(campusId)
      if (res.success && res.warning) {
        setImpactWarning(res.warning)
      }
    } catch (err) {
      console.error('Impact check error:', err)
    } finally {
      setCheckingImpact(false)
    }
  }

  const handleRequestTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampusId) {
      toast.error('Please select a target campus.')
      return
    }

    startTransition(async () => {
      const res = await requestCampusTransfer(selectedCampusId, transferReason)
      if (res.success) {
        if (res.status === 'verified') {
          toast.success('Campus affiliation updated and verified!')
        } else if (res.pending) {
          toast.success('Campus transfer request submitted for administrator review.')
        } else {
          toast.info('Campus updated. Please confirm your campus email to complete verification.')
        }
        setSelectedCampusId('')
        setTransferReason('')
        setImpactWarning(null)
      } else {
        toast.error(res.error || 'Failed to submit campus transfer.')
      }
    })
  }

  const userDomain = userEmail.split('@')[1]?.toLowerCase() || ''

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Campus Affiliation & Eligibility
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Manage your institution membership, domain verification, and cross-campus transfer requests.
        </p>
      </div>

      {/* Current Campus Card */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[--border-subtle] pb-5">
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
              <MapPin className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[--text-muted]">
                Primary Affiliation
              </span>
              <h3 className="font-bold text-base text-[--text-primary]">
                {currentCampus ? currentCampus.name : 'No Campus Assigned'}
              </h3>
              {currentCampus && (
                <p className="text-xs text-[--text-muted]">Campus Code: {currentCampus.slug || 'Main'}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {campusStatus === 'verified' && (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 py-1 px-2.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Verified Campus Member
              </Badge>
            )}
            {campusStatus === 'pending' && (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 gap-1 py-1 px-2.5">
                <Clock className="h-3.5 w-3.5" /> Affiliation Pending Review
              </Badge>
            )}
            {campusStatus === 'exception' && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 gap-1 py-1 px-2.5">
                Administrative Exception
              </Badge>
            )}
            {campusStatus === 'unverified' && (
              <Badge variant="outline" className="text-zinc-500 border-zinc-300 gap-1 py-1 px-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Email Confirmation Required
              </Badge>
            )}
          </div>
        </div>

        {/* Status Explanation Card */}
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4 space-y-2">
          <h4 className="text-xs font-semibold text-[--text-primary] flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-blue-600" />
            Why is my campus status &ldquo;{campusStatus}&rdquo;?
          </h4>
          <p className="text-xs text-[--text-secondary] leading-relaxed">
            {campusStatus === 'verified' && (
              <>
                Your institutional email (<code>{userEmail}</code>) belongs to an approved academic domain for{' '}
                <strong>{currentCampus?.name || 'this campus'}</strong>. You have full access to campus events, member-only tickets, and voting.
                {isOrganizer && ' Organizer event permissions remain attached to this campus and are not moved automatically when your membership changes.'}
              </>
            )}
            {campusStatus === 'pending' && (
              <>
                Your affiliation transfer request to <strong>{pendingCampus?.name || 'a new campus'}</strong> is awaiting administrator review. Reason provided: &ldquo;{exceptionReason || 'None provided'}&rdquo;.
              </>
            )}
            {campusStatus === 'exception' && (
              <>
                You have been granted an administrative exception by campus administrators. Reason on file: &ldquo;{exceptionReason}&rdquo;.
              </>
            )}
            {campusStatus === 'unverified' && (
              <>
                Your account is linked to this campus, but your institutional email confirmation is still pending. Check your inbox to verify your email.
              </>
            )}
          </p>
        </div>

        {/* Email Domain Lock Info */}
        <div className="flex items-center justify-between text-xs text-[--text-muted]">
          <span className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" /> Bound Email: <strong>{userEmail}</strong> ({userDomain})
          </span>
          <span>Verified Domains: {currentCampus?.approved_domains?.join(', ') || 'Open'}</span>
        </div>
      </div>

      {/* Transfer Campus Section */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 space-y-5 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-blue-600" />
            Request Campus Transfer
          </h3>
          <p className="text-xs text-[--text-secondary] mt-0.5">
            Moving to a different campus or cross-enrolled at another institution? Request an affiliation update.
          </p>
        </div>

        <form onSubmit={handleRequestTransfer} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="target-campus" className="text-xs">
              Select Destination Campus
            </Label>
            <select
              id="target-campus"
              value={selectedCampusId}
              onChange={(e) => handleSelectCampus(e.target.value)}
              className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-2.5 text-xs text-[--text-primary] focus:border-[--primary] focus:outline-none"
            >
              <option value="">Choose a campus...</option>
              {campuses
                .filter((c) => c.id !== currentCampus?.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.slug})
                  </option>
                ))}
            </select>
          </div>

          {checkingImpact && (
            <div className="flex items-center gap-2 text-xs text-[--text-muted]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking campus event dependencies...
            </div>
          )}

          {/* Organizer Event Warning */}
          {impactWarning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Important Notice for Event Organizers</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                {impactWarning}
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="transfer-reason" className="text-xs">
              Transfer Justification / Reason (Optional)
            </Label>
            <textarea
              id="transfer-reason"
              rows={2}
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              placeholder="e.g. Transferred to Computer Science program at Downtown Campus starting Fall 2026..."
              className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] p-3 text-xs text-[--text-primary] focus:border-[--primary] focus:outline-none"
            />
            <p className="text-[11px] text-[--text-muted]">
              If your email domain doesn&apos;t automatically match the new campus, administrators will review this reason to approve an affiliation exception.
            </p>
          </div>

          <Button
            type="submit"
            disabled={!selectedCampusId || isPending || checkingImpact}
            size="sm"
            className="gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Submit Transfer Request
          </Button>
        </form>
      </div>
    </div>
  )
}
