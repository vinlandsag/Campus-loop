'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { deleteEvent } from '@/app/(dashboard)/dashboard/events/actions'

interface DeleteEventButtonProps {
  eventId: string
  eventTitle: string
  registrationCount?: number
}

export function DeleteEventButton({ eventId, eventTitle, registrationCount = 0 }: DeleteEventButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (registrationCount > 0) {
      toast.error('Cannot delete this event while registrations are active', {
        description: `This event has ${registrationCount} registered attendee${registrationCount > 1 ? 's' : ''}. Please cancel the event with a reason so attendees are notified instead.`,
      })
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${eventTitle}"? This cannot be undone.`
    )
    if (!confirmed) return

    startTransition(async () => {
      const result = await deleteEvent(eventId)
      if (result.success) {
        toast.success('Event deleted')
        router.refresh()
      } else {
        toast.error('Failed to delete event', { description: result.error })
      }
    })
  }

  const hasRegistrations = registrationCount > 0

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
        hasRegistrations
          ? 'cursor-not-allowed bg-zinc-100 text-zinc-400 opacity-50 dark:bg-zinc-800 dark:text-zinc-500'
          : 'text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-200'
      }`}
      title={
        hasRegistrations
          ? `Cannot delete (${registrationCount} registered attendees). Use Cancel instead.`
          : 'Delete event'
      }
      aria-label="Delete event"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  )
}
