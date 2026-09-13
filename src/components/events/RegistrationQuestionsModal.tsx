'use client'

import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { X, CheckCircle2, AlertCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { RegistrationQuestion } from '@/types'

const emptySubscribe = () => () => {}

interface RegistrationQuestionsModalProps {
  isOpen: boolean
  onClose: () => void
  questions: RegistrationQuestion[]
  eventTitle: string
  onSubmit: (answers: Record<string, string>) => void
  isSubmitting?: boolean
}

export function RegistrationQuestionsModal({
  isOpen,
  onClose,
  questions,
  eventTitle,
  onSubmit,
  isSubmitting = false,
}: RegistrationQuestionsModalProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !isClient) return null

  const handleChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
    if (error) setError(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate required questions
    for (const q of questions) {
      if (q.is_required) {
        const val = answers[q.id]?.trim()
        if (!val || (q.question_type === 'checkbox' && val !== 'true')) {
          setError(`Please answer the required question: "${q.question_text}"`)
          return
        }
      }
    }

    onSubmit(answers)
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="questions-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Box */}
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[--border-subtle] px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            <h2 id="questions-modal-title" className="font-semibold text-lg text-[--text-primary]">
              Registration Details
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <p className="text-xs text-[--text-secondary] mb-5">
            The organizer of <span className="font-semibold text-[--text-primary]">&ldquo;{eventTitle}&rdquo;</span> has requested the following information for attendees:
          </p>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            {questions.map((q) => (
              <div key={q.id} className="space-y-1.5">
                <Label htmlFor={`q-${q.id}`} className="text-sm font-medium text-[--text-primary]">
                  {q.question_text}{' '}
                  {q.is_required && <span className="text-rose-500">*</span>}
                </Label>

                {/* Question Type Rendering */}
                {q.question_type === 'text' && (
                  <Input
                    id={`q-${q.id}`}
                    type="text"
                    value={answers[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    placeholder="Your answer..."
                    required={q.is_required}
                    className="text-sm"
                  />
                )}

                {q.question_type === 'textarea' && (
                  <textarea
                    id={`q-${q.id}`}
                    rows={3}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    placeholder="Your answer..."
                    required={q.is_required}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                )}

                {q.question_type === 'select' && (
                  <select
                    id={`q-${q.id}`}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleChange(q.id, e.target.value)}
                    required={q.is_required}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select an option...</option>
                    {(q.options || []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {q.question_type === 'checkbox' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id={`q-${q.id}`}
                      type="checkbox"
                      checked={answers[q.id] === 'true'}
                      onChange={(e) => handleChange(q.id, e.target.checked ? 'true' : 'false')}
                      required={q.is_required}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor={`q-${q.id}`} className="text-xs text-[--text-secondary]">
                      I confirm and agree
                    </label>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 border-t border-[--border-subtle] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-medium"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Submitting...' : 'Confirm Registration'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
