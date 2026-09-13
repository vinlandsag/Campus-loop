'use client'

import { Globe, Bot, Check } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EventTranslation } from '@/types'

interface LanguageSelectorProps {
  translations: EventTranslation[]
  activeTranslation: EventTranslation | null
  onSelectLanguage: (translation: EventTranslation | null) => void
}

export function LanguageSelector({
  translations,
  activeTranslation,
  onSelectLanguage,
}: LanguageSelectorProps) {
  if (translations.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'gap-1.5 text-xs rounded-xl border-[--border-subtle] bg-[--bg-surface] shadow-sm'
            )}
          >
            <Globe className="h-3.5 w-3.5 text-blue-600" />
            <span>
              Language: {activeTranslation ? activeTranslation.language_name : 'English (Original)'}
            </span>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem
              onClick={() => onSelectLanguage(null)}
              className="flex items-center justify-between text-xs"
            >
              <span className="font-medium">English (Original)</span>
              {!activeTranslation && <Check className="h-3.5 w-3.5 text-blue-600" />}
            </DropdownMenuItem>

            {translations.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => onSelectLanguage(t)}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium">{t.language_name}</span>
                  {t.is_machine_translated && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.2 text-[10px] text-amber-800 dark:text-amber-300 font-semibold">
                      <Bot className="h-2.5 w-2.5" />
                      Auto
                    </span>
                  )}
                </div>
                {activeTranslation?.id === t.id && (
                  <Check className="h-3.5 w-3.5 text-blue-600" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Machine translation alert banner */}
      {activeTranslation?.is_machine_translated && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-3 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
          <Bot className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="space-y-0.5">
            <p className="font-semibold">Machine-Generated Translation</p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300/90 leading-relaxed">
              This content was translated automatically. In case of ambiguity, refer to the original English text or contact the event organizer.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
