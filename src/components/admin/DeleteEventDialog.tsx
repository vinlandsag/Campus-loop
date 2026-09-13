'use client'

import { useState } from 'react'
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminDeleteEvent } from '@/app/actions/admin.actions'
import type { AdminEvent } from '@/types'

interface DeleteEventDialogProps {
  event: AdminEvent
  isOpen: boolean
  onClose: () => void
  onDeleted: (eventId: string) => void
}

const DELETION_REASONS = [
  'Community Guidelines Violation (Hate speech, harassment, illegal)',
  'Inappropriate or adult content',
  'Commercial spam or scam event',
  'Safety or physical danger risk',
  'Fraudulent organizer identity / impersonation',
  'Copyright / intellectual property infringement',
  'Campus policy violation',
  'Other moderation reason',
]

export function DeleteEventDialog({
  event,
  isOpen,
  onClose,
  onDeleted,
}: DeleteEventDialogProps) {
  const [selectedReason, setSelectedReason] = useState(DELETION_REASONS[0])
  const [adminNotes, setAdminNotes] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isOpen) return null

  const isConfirmed = confirmText === 'DELETE'

  async function handleDelete() {
    if (!isConfirmed) return
    setIsDeleting(true)

    try {
      const fullReason = `${selectedReason}${adminNotes ? `: ${adminNotes}` : ''}`
      const result = await adminDeleteEvent(event.id, fullReason, adminNotes)

      if (result.success) {
        toast.success(`Event "${event.title}" permanently removed`, {
          description: `${result.data?.affectedUsers || 0} registered attendees notified.`,
        })
        onDeleted(event.id)
        onClose()
      } else {
        toast.error('Failed to delete event', { description: result.error })
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded-xl border border-red-200 bg-[--bg-surface] p-6 shadow-2xl dark:border-red-900/50">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-[--text-primary]">
              Permanently Remove Event
            </h3>
            <p className="mt-1 text-xs text-[--text-secondary]">
              This action is permanent and bypasses the registration lock.
            </p>
          </div>
        </div>

        {/* Warning Callout */}
        <div className="mt-4 rounded-lg border border-red-200/80 bg-red-50/70 p-3.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-semibold">Event: {event.title}</p>
          <p className="mt-1">
            Organizer: <strong>{event.organizer_name}</strong> • Campus:{' '}
            <strong>{event.campus_name || 'All Campuses'}</strong>
          </p>
          {event.registration_count > 0 && (
            <p className="mt-1 font-bold text-red-700 dark:text-red-400">
              ⚠️ Warning: {event.registration_count} registered/waitlisted attendees will have their tickets cancelled and receive an immediate moderation notice.
            </p>
          )}
        </div>

        {/* Reason Select */}
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-[--text-secondary]">
              Reason for Removal <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedReason}
              onChange={(e) => setSelectedReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-xs text-[--text-primary] focus:border-red-500 focus:outline-none"
            >
              {DELETION_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[--text-secondary]">
              Admin Investigation Notes (Stored in immutable audit log)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Reported by campus security; confirmed violations of student code of conduct section 4."
              rows={2}
              className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-xs text-[--text-primary] placeholder-[--text-muted] focus:border-red-500 focus:outline-none"
            />
          </div>

          {/* Type DELETE to confirm */}
          <div>
            <label className="block text-xs font-medium text-[--text-secondary]">
              To confirm, type <span className="font-mono font-bold text-red-600 dark:text-red-400">DELETE</span> below:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE"
              className="mt-1 w-full rounded-lg border border-[--border-subtle] bg-[--bg-base] p-2.5 text-xs font-mono text-[--text-primary] placeholder-[--text-muted] focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-[--border-subtle] px-4 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isConfirmed || isDeleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Permanently Remove Event
          </button>
        </div>
      </div>
    </div>
  )
}
