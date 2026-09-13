'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  GraduationCap,
  Mail,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  adminApproveOrganizer,
  adminRejectOrganizer,
  adminSuspendOrganizer,
  adminUnsuspendOrganizer,
  adminRevokeOrganizer,
} from '@/app/actions/admin.actions'
import type { AdminOrganizer, OrganizerApprovalStatus } from '@/types'

interface OrganizerManagementClientProps {
  initialOrganizers: AdminOrganizer[]
}

type TabKey = 'all' | 'pending' | 'approved' | 'suspended'

export function OrganizerManagementClient({
  initialOrganizers,
}: OrganizerManagementClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<TabKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [organizers, setOrganizers] = useState<AdminOrganizer[]>(initialOrganizers)

  // Modal dialog states
  const [actionModal, setActionModal] = useState<{
    type: 'reject' | 'suspend' | 'unsuspend' | 'revoke'
    organizer: AdminOrganizer
  } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Filter organizers
  const filteredOrganizers = organizers.filter((org) => {
    // Tab filter
    if (activeTab === 'pending' && org.approval_status !== 'pending') return false
    if (activeTab === 'approved' && org.approval_status !== 'approved') return false
    if (activeTab === 'suspended' && org.approval_status !== 'suspended') return false

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = org.full_name.toLowerCase().includes(q)
      const matchEmail = org.email.toLowerCase().includes(q)
      const matchCampus = (org.campus_name || '').toLowerCase().includes(q)
      return matchName || matchEmail || matchCampus
    }

    return true
  })

  // Counts
  const counts = {
    all: organizers.length,
    pending: organizers.filter((o) => o.approval_status === 'pending').length,
    approved: organizers.filter((o) => o.approval_status === 'approved').length,
    suspended: organizers.filter((o) => o.approval_status === 'suspended').length,
  }

  // Handle Approve
  async function handleApprove(org: AdminOrganizer) {
    startTransition(async () => {
      const result = await adminApproveOrganizer(org.id)
      if (result.success) {
        toast.success(`Approved ${org.full_name}`, {
          description: 'Organizer privileges granted and notification sent.',
        })
        setOrganizers((prev) =>
          prev.map((o) =>
            o.id === org.id
              ? { ...o, is_verified: true, approval_status: 'approved' as OrganizerApprovalStatus }
              : o
          )
        )
        router.refresh()
      } else {
        toast.error('Failed to approve organizer', { description: result.error })
      }
    })
  }

  // Handle Modal Submit
  async function handleModalSubmit() {
    if (!actionModal) return

    const { type, organizer } = actionModal
    setActionLoading(true)

    try {
      if (type === 'reject') {
        const result = await adminRejectOrganizer(organizer.id, actionReason)
        if (result.success) {
          toast.success(`Rejected ${organizer.full_name}`, {
            description: 'Account reverted to student role.',
          })
          setOrganizers((prev) =>
            prev.map((o) =>
              o.id === organizer.id
                ? { ...o, role: 'student', is_verified: false, approval_status: 'rejected' as OrganizerApprovalStatus }
                : o
            )
          )
          closeModal()
          router.refresh()
        } else {
          toast.error('Failed to reject application', { description: result.error })
        }
      } else if (type === 'suspend') {
        if (!actionReason.trim()) {
          toast.error('Suspension reason is required')
          setActionLoading(false)
          return
        }
        const result = await adminSuspendOrganizer(organizer.id, actionReason)
        if (result.success) {
          toast.success(`Suspended ${organizer.full_name}`, {
            description: 'Events unpublished and organizer access suspended.',
          })
          setOrganizers((prev) =>
            prev.map((o) =>
              o.id === organizer.id
                ? { ...o, is_suspended: true, approval_status: 'suspended' as OrganizerApprovalStatus }
                : o
            )
          )
          closeModal()
          router.refresh()
        } else {
          toast.error('Failed to suspend organizer', { description: result.error })
        }
      } else if (type === 'unsuspend') {
        const result = await adminUnsuspendOrganizer(organizer.id)
        if (result.success) {
          toast.success(`Reinstated ${organizer.full_name}`, {
            description: 'Suspension lifted and notification sent.',
          })
          setOrganizers((prev) =>
            prev.map((o) =>
              o.id === organizer.id
                ? { ...o, is_suspended: false, approval_status: 'approved' as OrganizerApprovalStatus }
                : o
            )
          )
          closeModal()
          router.refresh()
        } else {
          toast.error('Failed to lift suspension', { description: result.error })
        }
      } else if (type === 'revoke') {
        if (!actionReason.trim()) {
          toast.error('Revocation reason is required')
          setActionLoading(false)
          return
        }
        const result = await adminRevokeOrganizer(organizer.id, actionReason)
        if (result.success) {
          toast.success(`Revoked access for ${organizer.full_name}`, {
            description: 'Organizer privileges removed and reverted to student.',
          })
          setOrganizers((prev) =>
            prev.map((o) =>
              o.id === organizer.id
                ? { ...o, role: 'student', is_verified: false, approval_status: 'revoked' as OrganizerApprovalStatus }
                : o
            )
          )
          closeModal()
          router.refresh()
        } else {
          toast.error('Failed to revoke privileges', { description: result.error })
        }
      }
    } finally {
      setActionLoading(false)
    }
  }

  function closeModal() {
    setActionModal(null)
    setActionReason('')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
          Organizer Management
        </h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Approve pending organizer applications, suspend violators, or revoke organizer access.
        </p>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex rounded-lg border border-[--border-subtle] bg-[--bg-surface] p-1">
          <TabButton
            label="All"
            count={counts.all}
            active={activeTab === 'all'}
            onClick={() => setActiveTab('all')}
          />
          <TabButton
            label="Pending"
            count={counts.pending}
            active={activeTab === 'pending'}
            badge="amber"
            onClick={() => setActiveTab('pending')}
          />
          <TabButton
            label="Approved"
            count={counts.approved}
            active={activeTab === 'approved'}
            badge="green"
            onClick={() => setActiveTab('approved')}
          />
          <TabButton
            label="Suspended"
            count={counts.suspended}
            active={activeTab === 'suspended'}
            badge="red"
            onClick={() => setActiveTab('suspended')}
          />
        </div>

        {/* Search Input */}
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
          <input
            type="text"
            placeholder="Search by name, email, campus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[--border-subtle] bg-[--bg-surface] py-2 pl-9 pr-3 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Organizers List */}
      {filteredOrganizers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
          <Users className="h-10 w-10 text-[--text-muted]" />
          <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">No organizers found</h3>
          <p className="mt-1 text-xs text-[--text-muted]">
            {searchQuery
              ? 'Try adjusting your search criteria.'
              : activeTab === 'pending'
              ? 'There are no pending organizer verification requests at this time.'
              : 'No records match this filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]">
          <div className="divide-y divide-[--border-subtle]">
            {filteredOrganizers.map((org) => {
              const initials = org.full_name
                ? org.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : org.email.slice(0, 2).toUpperCase()

              return (
                <div
                  key={org.id}
                  className="flex flex-col gap-4 p-5 transition-colors hover:bg-[--bg-subtle] sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left: Organizer details */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[--text-primary]">
                          {org.full_name}
                        </span>
                        <StatusBadge status={org.approval_status} />
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[--text-secondary]">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3.5 w-3.5 text-[--text-muted]" />
                          {org.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <GraduationCap className="h-3.5 w-3.5 text-[--text-muted]" />
                          {org.campus_name || 'No Campus Assigned'}
                        </span>
                        {org.college && <span>College: {org.college}</span>}
                        {org.department && <span>Dept: {org.department}</span>}
                      </div>

                      {org.bio && (
                        <p className="mt-2 line-clamp-2 text-xs text-[--text-muted]">
                          {org.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                    {org.approval_status === 'pending' && (
                      <>
                        <button
                          disabled={isPending}
                          onClick={() => handleApprove(org)}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Approve
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => setActionModal({ type: 'reject', organizer: org })}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 disabled:opacity-50"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </>
                    )}

                    {org.approval_status === 'approved' && (
                      <>
                        <button
                          disabled={isPending}
                          onClick={() => setActionModal({ type: 'suspend', organizer: org })}
                          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300 disabled:opacity-50"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Suspend
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => setActionModal({ type: 'revoke', organizer: org })}
                          className="flex items-center gap-1.5 rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-semibold text-[--text-muted] transition-colors hover:bg-[--bg-muted] hover:text-red-600 disabled:opacity-50"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Revoke
                        </button>
                      </>
                    )}

                    {org.approval_status === 'suspended' && (
                      <>
                        <button
                          disabled={isPending}
                          onClick={() => setActionModal({ type: 'unsuspend', organizer: org })}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Unsuspend
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => setActionModal({ type: 'revoke', organizer: org })}
                          className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 disabled:opacity-50"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Revoke
                        </button>
                      </>
                    )}

                    {org.approval_status === 'revoked' && (
                      <span className="text-xs text-[--text-muted]">Privileges Revoked</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Dialog Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl">
            <h3 className="font-display text-lg font-bold text-[--text-primary]">
              {actionModal.type === 'reject' && 'Reject Organizer Application'}
              {actionModal.type === 'suspend' && 'Suspend Organizer Account'}
              {actionModal.type === 'unsuspend' && 'Lift Suspension'}
              {actionModal.type === 'revoke' && 'Revoke Organizer Privileges'}
            </h3>

            <p className="mt-2 text-sm text-[--text-secondary]">
              {actionModal.type === 'reject' && (
                <>
                  Are you sure you want to reject the application for{' '}
                  <strong className="text-[--text-primary]">{actionModal.organizer.full_name}</strong>?
                  Their account will remain active as a student.
                </>
              )}
              {actionModal.type === 'suspend' && (
                <>
                  Suspending <strong className="text-[--text-primary]">{actionModal.organizer.full_name}</strong>{' '}
                  will unpublish their active events and prevent them from creating new events.
                </>
              )}
              {actionModal.type === 'unsuspend' && (
                <>
                  Reinstate <strong className="text-[--text-primary]">{actionModal.organizer.full_name}</strong>{' '}
                  and restore their ability to manage campus events?
                </>
              )}
              {actionModal.type === 'revoke' && (
                <>
                  This will revoke organizer status for{' '}
                  <strong className="text-[--text-primary]">{actionModal.organizer.full_name}</strong>{' '}
                  and revert their role to student.
                </>
              )}
            </p>

            {(actionModal.type === 'reject' ||
              actionModal.type === 'suspend' ||
              actionModal.type === 'revoke') && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-[--text-secondary]">
                  Reason {actionModal.type !== 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder={
                    actionModal.type === 'reject'
                      ? 'Optional reason to include in user notification...'
                      : 'Provide an audit reason for this action...'
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={actionLoading}
                className="rounded-lg border border-[--border-subtle] px-4 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                disabled={actionLoading}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50 ${
                  actionModal.type === 'unsuspend'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : actionModal.type === 'suspend'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {actionModal.type === 'reject' && 'Confirm Rejection'}
                {actionModal.type === 'suspend' && 'Suspend Organizer'}
                {actionModal.type === 'unsuspend' && 'Confirm Reinstatement'}
                {actionModal.type === 'revoke' && 'Revoke Privileges'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function TabButton({
  label,
  count,
  active,
  badge,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  badge?: 'amber' | 'green' | 'red'
  onClick: () => void
}) {
  const badgeClasses = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-[--bg-muted] text-[--text-primary] shadow-xs'
          : 'text-[--text-muted] hover:text-[--text-primary]'
      }`}
    >
      <span>{label}</span>
      <span
        className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
          badge && badgeClasses[badge]
            ? badgeClasses[badge]
            : 'bg-[--bg-subtle] text-[--text-muted]'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function StatusBadge({ status }: { status: OrganizerApprovalStatus }) {
  switch (status) {
    case 'pending':
      return (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Pending Approval
        </span>
      )
    case 'approved':
      return (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Verified Organizer
        </span>
      )
    case 'suspended':
      return (
        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
          Suspended
        </span>
      )
    case 'revoked':
      return (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Revoked
        </span>
      )
    default:
      return null
  }
}
