'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { X, Star, AlertTriangle, CheckCircle2, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { submitEventFeedback } from '@/app/actions/feedback.actions'
import type { FeedbackIssueCategory, EventFeedback } from '@/types'

interface EventFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventTitle: string
  initialFeedback?: EventFeedback | null
  onSuccess?: () => void
}

export function EventFeedbackModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  initialFeedback,
  onSuccess,
}: EventFeedbackModalProps) {
  const [rating, setRating] = useState<number>(initialFeedback?.rating || 5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string>(initialFeedback?.feedback || '')
  const [hasIssue, setHasIssue] = useState<boolean>(initialFeedback?.has_issue || false)
  const [issueCategory, setIssueCategory] = useState<FeedbackIssueCategory>(
    initialFeedback?.issue_category || 'organization'
  )
  const [issueDescription, setIssueDescription] = useState<string>(
    initialFeedback?.issue_description || ''
  )
  const [isPending, startTransition] = useTransition()

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const result = await submitEventFeedback({
        eventId,
        rating,
        feedback,
        hasIssue,
        issueCategory: hasIssue ? issueCategory : null,
        issueDescription: hasIssue ? issueDescription : null,
      })

      if (result.success) {
        toast.success('Thank you! Your feedback was privately submitted.')
        onSuccess?.()
        onClose()
      } else {
        toast.error(result.error || 'Failed to submit feedback.')
      }
    })
  }

  const activeRating = hoverRating !== null ? hoverRating : rating

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[--border-subtle] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h2 id="feedback-title" className="font-display text-lg font-bold text-[--text-primary]">
                Event Feedback
              </h2>
              <p className="text-xs text-[--text-secondary] truncate max-w-xs">{eventTitle}</p>
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

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Star Rating */}
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[--text-secondary]">
              How was your experience?
            </span>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="rounded p-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <Star
                    className={`h-8 w-8 transition-colors ${
                      star <= activeRating
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-zinc-300 dark:text-zinc-700'
                    }`}
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-medium text-[--text-muted]">
              {activeRating === 5 && 'Outstanding!'}
              {activeRating === 4 && 'Good experience'}
              {activeRating === 3 && 'Average'}
              {activeRating === 2 && 'Needs improvement'}
              {activeRating === 1 && 'Disappointing'}
            </span>
          </div>

          {/* Feedback Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[--text-primary]">
              Optional comments or suggestions
            </label>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="What did you enjoy? What could the organizers do better next time?"
              className="w-full rounded-xl border border-[--border-subtle] bg-[--bg-default] px-3.5 py-2.5 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Report an Issue Toggle */}
          <div className="rounded-xl border border-[--border-subtle] bg-[--bg-default] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-[--text-primary] cursor-pointer">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Report an issue with this event
              </label>
              <input
                type="checkbox"
                checked={hasIssue}
                onChange={(e) => setHasIssue(e.target.checked)}
                className="h-4 w-4 rounded border-[--border-subtle] text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            {hasIssue && (
              <div className="space-y-3 pt-2 border-t border-[--border-subtle]">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[--text-secondary]">
                    Issue category
                  </label>
                  <select
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value as FeedbackIssueCategory)}
                    className="w-full rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs text-[--text-primary] focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="organization">Organization & Logistics</option>
                    <option value="venue">Venue & Accessibility</option>
                    <option value="audio_visual">Audio / Visual / Equipment</option>
                    <option value="scheduling">Schedule / Timing</option>
                    <option value="safety">Safety & Security</option>
                    <option value="other">Other issue</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[--text-secondary]">
                    Describe what happened
                  </label>
                  <textarea
                    rows={2}
                    value={issueDescription}
                    onChange={(e) => setIssueDescription(e.target.value)}
                    placeholder="Briefly describe the issue encountered..."
                    className="w-full rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-2 text-xs text-[--text-primary] placeholder:text-[--text-muted] focus:border-emerald-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-[--text-muted]">
            🔒 <strong>Private & Anonymized:</strong> The event organizer sees only aggregate rating metrics and anonymous feedback. Your identity is never revealed.
          </p>

          {/* Action Buttons */}
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isPending ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
