'use client'

import { useState, useTransition, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Ban, Loader2, AlertTriangle } from 'lucide-react'
import { cancelEvent } from '@/app/(dashboard)/dashboard/events/actions'
import { Button } from '@/components/ui/button'

const emptySubscribe = () => () => {}

interface CancelEventDialogProps {
  eventId: string
  eventTitle: string
  registrationCount?: number
  isCancelled?: boolean
}

export function CancelEventDialog({
  eventId,
  eventTitle,
  registrationCount = 0,
  isCancelled = false,
}: CancelEventDialogProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false)

  if (isCancelled) {
    return (
      <span className="text-xs text-[--text-muted] italic" title="Event is already cancelled">
        Cancelled
      </span>
    )
  }

  const handleOpen = () => {
    setReason('')
    setError(null)
    setIsOpen(true)
  }

  const handleClose = () => {
    if (isPending) return
    setIsOpen(false)
  }

  const handleConfirmCancel = () => {
    const trimmed = reason.trim()
    if (trimmed.length < 5) {
      setError('Please provide a reason of at least 5 characters for attendees.')
      return
    }

    startTransition(async () => {
      const result = await cancelEvent(eventId, trimmed)
      if (result.success) {
        toast.success('Event cancelled successfully', {
          description: registrationCount > 0 ? `Notified ${registrationCount} registered attendees.` : undefined,
        })
        setIsOpen(false)
        router.refresh()
      } else {
        setError(result.error || 'Failed to cancel event')
        toast.error('Failed to cancel event', { description: result.error })
      }
    })
  }

  const modalContent = isOpen ? (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 whitespace-normal"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl space-y-4 text-left whitespace-normal break-words"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-lg text-zinc-900 dark:text-zinc-100">
              Cancel Event
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {eventTitle}
            </p>
          </div>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-normal break-words">
          Cancelling this event will preserve attendee registration history, update the event status, and automatically notify all registered attendees.
        </p>

        {registrationCount > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300 font-medium whitespace-normal break-words leading-relaxed">
            📢 <strong>{registrationCount} attendee{registrationCount > 1 ? 's' : ''}</strong> will receive an in-app notification with your cancellation reason.
          </div>
        )}

        <div className="space-y-1.5 whitespace-normal">
          <label htmlFor="cancel-reason" className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Cancellation Reason *
          </label>
          <textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
            placeholder="e.g. Venue double-booked, rescheduled for next term, or organizer illness..."
            className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 p-3 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 whitespace-normal break-words"
          />
          {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
            className="border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Keep Event
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirmCancel}
            disabled={isPending}
            className="gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cancelling...
              </>
            ) : (
              'Confirm Cancellation'
            )}
          </Button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
      <button
        onClick={handleOpen}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition-all hover:bg-amber-50 hover:text-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-200"
        title="Cancel event"
        aria-label="Cancel event"
      >
        <Ban className="h-3.5 w-3.5" />
      </button>

      {isClient && modalContent && createPortal(modalContent, document.body)}
    </>
  )
}
