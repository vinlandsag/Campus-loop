'use client'

import { useState } from 'react'
import { X, Clock, Award, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { applyForVolunteerRole } from '@/app/actions/volunteer.actions'
import type { EventVolunteerRole } from '@/types'

interface VolunteerApplyModalProps {
  role: EventVolunteerRole | null
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function VolunteerApplyModal({
  role,
  isOpen,
  onClose,
  onSuccess,
}: VolunteerApplyModalProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen || !role) return null

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await applyForVolunteerRole(role.id, notes)
      if (!res.success) {
        setError(res.error || 'Failed to submit volunteer application.')
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        onSuccess()
        onClose()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const formatShift = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return 'Flexible / To be coordinated'
    const start = new Date(startStr)
    const formattedDate = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
    const startTime = start.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    if (!endStr) return `${formattedDate} at ${startTime}`
    const end = new Date(endStr)
    const endTime = end.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    })
    return `${formattedDate}, ${startTime} – ${endTime}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-2xl transition-all">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
            Volunteer Opportunity
          </span>
          <h2 className="mt-2 text-xl font-bold text-[--text-primary]">{role.title}</h2>
        </div>

        {/* Role Details */}
        <div className="space-y-3 rounded-xl border border-[--border-subtle] bg-[--bg-muted] p-4 text-xs">
          <div className="flex items-center gap-2 text-[--text-secondary]">
            <Clock className="h-4 w-4 shrink-0 text-amber-500" />
            <span>Shift: {formatShift(role.shift_start || null, role.shift_end || null)}</span>
          </div>

          <div className="flex items-center gap-2 text-[--text-secondary]">
            <Users className="h-4 w-4 shrink-0 text-amber-500" />
            <span>
              {role.available_spots ?? (role.capacity - (role.signup_count ?? 0))} of {role.capacity} spots remaining
            </span>
          </div>

          {role.required_skills && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Award className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-medium text-[--text-secondary]">Required Skills:</span>
              {role.required_skills
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((skill: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-md bg-zinc-200/80 px-2 py-0.5 text-[11px] font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                  >
                    {skill}
                  </span>
                ))}
            </div>
          )}

          {role.description && (
            <p className="pt-2 text-[13px] leading-relaxed text-[--text-secondary] border-t border-[--border-subtle]">
              {role.description}
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="mt-4 flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <p className="mt-2 font-semibold text-emerald-600 dark:text-emerald-400">
              Application Submitted!
            </p>
            <p className="text-xs text-[--text-secondary]">
              The organizer will review your application. Check My Events for status updates.
            </p>
          </div>
        ) : (
          <form onSubmit={handleApply} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-[--text-secondary]">
                Relevant experience or notes for organizer (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Previous event coordination experience, emergency first-aid certified, specific availability..."
                className="mt-1 w-full rounded-xl border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2.5 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <p className="text-[11px] text-[--text-muted]">
              Volunteer applications do not grant event administrative permissions. Organizers will contact you through event updates.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="rounded-xl border border-[--border-subtle] px-4 py-2 text-sm font-medium text-[--text-secondary] hover:bg-[--bg-muted]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (role.available_spots ?? 1) <= 0}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm Application
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
