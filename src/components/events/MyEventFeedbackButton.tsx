'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EventFeedbackModal } from '@/components/events/EventFeedbackModal'
import type { EventFeedback } from '@/types'

interface MyEventFeedbackButtonProps {
  eventId: string
  eventTitle: string
  initialFeedback?: EventFeedback | null
}

export function MyEventFeedbackButton({
  eventId,
  eventTitle,
  initialFeedback,
}: MyEventFeedbackButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasFeedback, setHasFeedback] = useState(Boolean(initialFeedback))

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 border-amber-300 bg-amber-50/50 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-900/40"
      >
        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
        {hasFeedback ? 'Edit Feedback' : 'Rate & Feedback'}
      </Button>

      <EventFeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        eventId={eventId}
        eventTitle={eventTitle}
        initialFeedback={initialFeedback}
        onSuccess={() => setHasFeedback(true)}
      />
    </>
  )
}
