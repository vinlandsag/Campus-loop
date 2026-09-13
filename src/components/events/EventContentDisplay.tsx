'use client'

import { useState } from 'react'
import { LanguageSelector } from './LanguageSelector'
import type { EventTranslation } from '@/types'

interface EventContentDisplayProps {
  initialTitle: string
  initialDescription: string
  initialWhatToBring?: string | null
  initialEligibility?: string | null
  initialChangeNotice?: string | null
  translations: EventTranslation[]
}

export function EventContentDisplay({
  initialTitle,
  initialDescription,
  initialWhatToBring,
  initialEligibility,
  initialChangeNotice,
  translations,
}: EventContentDisplayProps) {
  const [activeTranslation, setActiveTranslation] = useState<EventTranslation | null>(null)

  const title = activeTranslation ? activeTranslation.title : initialTitle
  const description = activeTranslation ? activeTranslation.description : initialDescription
  const whatToBring = activeTranslation?.details?.what_to_bring || initialWhatToBring
  const eligibility = activeTranslation?.details?.eligibility || initialEligibility
  const changeNotice = activeTranslation?.details?.change_notice || initialChangeNotice

  return (
    <div className="space-y-6">
      {/* Language Selector */}
      {translations.length > 0 && (
        <div className="flex items-center justify-between">
          <LanguageSelector
            translations={translations}
            activeTranslation={activeTranslation}
            onSelectLanguage={setActiveTranslation}
          />
        </div>
      )}

      {/* Title */}
      <h1 className="font-display text-3xl font-bold tracking-tight text-[--text-primary] sm:text-4xl">
        {title}
      </h1>

      {/* Description */}
      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold text-[--text-primary]">
          About this event
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none text-[--text-secondary] whitespace-pre-wrap leading-relaxed">
          {description}
        </div>
      </div>

      {/* Dynamic Translated Extras if present */}
      {(whatToBring || eligibility || changeNotice) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {eligibility && (
            <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 text-xs space-y-1">
              <span className="font-semibold text-[--text-primary]">Eligibility</span>
              <p className="text-[--text-secondary]">{eligibility}</p>
            </div>
          )}
          {whatToBring && (
            <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 text-xs space-y-1">
              <span className="font-semibold text-[--text-primary]">What to bring</span>
              <p className="text-[--text-secondary]">{whatToBring}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
