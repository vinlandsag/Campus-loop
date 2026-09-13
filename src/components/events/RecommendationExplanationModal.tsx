'use client'

import React, { useState } from 'react'
import { Sparkles, X, ShieldCheck, CheckCircle2 } from 'lucide-react'
import type { RecommendationExplanation } from '@/types'

interface RecommendationExplanationModalProps {
  eventTitle: string
  explanation: RecommendationExplanation
}

export function RecommendationExplanationModal({
  eventTitle,
  explanation,
}: RecommendationExplanationModalProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen(true)
        }}
        className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-950/80 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-200 dark:hover:bg-violet-900"
        title="View transparent recommendation explanation"
      >
        <Sparkles className="h-3 w-3 text-violet-600 dark:text-violet-400" />
        <span>Why recommended?</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setIsOpen(false)
          }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-[--border-subtle] pb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-900/60 dark:text-violet-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[--text-primary]">
                    Why am I seeing this?
                  </h3>
                  <p className="text-xs text-[--text-muted]">Transparent ranking explanation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Event Title */}
            <div className="mt-4">
              <h4 className="font-semibold text-sm text-[--text-primary] line-clamp-2">
                {eventTitle}
              </h4>
              <div className="mt-1 flex items-center gap-2 text-xs text-[--text-secondary]">
                <span className="font-mono font-medium text-violet-600 dark:text-violet-400">
                  Score: {explanation.score} pts
                </span>
              </div>
            </div>

            {/* Factors list */}
            <div className="mt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
                Matching Factors
              </p>
              <div className="space-y-2">
                {explanation.reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-2.5 text-xs text-[--text-secondary]"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Privacy Promise */}
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                <span>Privacy Guarantee</span>
              </div>
              <p className="mt-1 leading-relaxed text-emerald-700 dark:text-emerald-400 text-[11px]">
                CampusLoop never sells your data or broadcasts your attendance without your explicit
                consent. Rankings are calculated based only on your declared preferences and mutual consented friends.
              </p>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-xl bg-[--bg-muted] px-4 py-2 text-xs font-semibold text-[--text-primary] hover:bg-[--border-subtle] transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
