'use client'

import React, { useState, useTransition } from 'react'
import { Camera, ShieldCheck, Check, Loader2, ShieldAlert } from 'lucide-react'
import { updatePhotoPrivacyPreference } from '@/app/actions/gallery.actions'
import type { PhotoPrivacyPreference } from '@/types'

interface PhotoPrivacyPreferencesFormProps {
  initialPreference: PhotoPrivacyPreference | null
}

export function PhotoPrivacyPreferencesForm({
  initialPreference,
}: PhotoPrivacyPreferencesFormProps) {
  const [optOut, setOptOut] = useState(
    initialPreference?.opt_out_photo_appearances ?? false
  )
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const res = await updatePhotoPrivacyPreference(optOut)
      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(res.error || 'Failed to update photo privacy preference.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-muted]/30 p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <label
              htmlFor="opt-out-photos"
              className="text-sm font-semibold text-[--text-primary] cursor-pointer"
            >
              Opt out of appearing in campus event photos
            </label>
          </div>
          <p className="text-xs text-[--text-secondary] leading-relaxed max-w-lg">
            When enabled, campus event coordinators are informed that you have exercised your appearance opt-out. If your likeness appears in any published event gallery, you can report it for prompt organizer removal.
          </p>
          {optOut && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
              <ShieldAlert className="h-3 w-3" />
              <span>Photo Opt-Out Active: Organizers must honor your privacy request</span>
            </div>
          )}
        </div>

        <input
          id="opt-out-photos"
          type="checkbox"
          checked={optOut}
          onChange={(e) => setOptOut(e.target.checked)}
          className="h-5 w-5 rounded border-[--border-default] text-purple-600 focus:ring-purple-500 mt-1 cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Photo privacy preference saved!</span>
            </span>
          )}
          {error && (
            <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
          )}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-2 text-xs font-semibold text-white hover:bg-purple-700 active:scale-98 transition-colors disabled:opacity-60 shadow-sm cursor-pointer"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Save Photo Preference</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
