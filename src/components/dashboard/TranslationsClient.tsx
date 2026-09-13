'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Globe,
  Plus,
  Trash2,
  Bot,
  CheckCircle2,
  ArrowLeft,
  X,
  Languages,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  saveEventTranslation,
  deleteEventTranslation,
} from '@/app/actions/translation.actions'
import type { EventTranslation } from '@/types'

const PRESET_LANGUAGES = [
  { code: 'es', name: 'Español (Spanish)' },
  { code: 'fr', name: 'Français (French)' },
  { code: 'zh', name: '中文 (Mandarin Chinese)' },
  { code: 'hi', name: 'हिन्दी (Hindi)' },
  { code: 'de', name: 'Deutsch (German)' },
  { code: 'ja', name: '日本語 (Japanese)' },
  { code: 'ar', name: 'العربية (Arabic)' },
  { code: 'pt', name: 'Português (Portuguese)' },
  { code: 'ko', name: '한국어 (Korean)' },
  { code: 'it', name: 'Italiano (Italian)' },
  { code: 'ru', name: 'Русский (Russian)' },
]

interface TranslationsClientProps {
  eventId: string
  eventTitle: string
  initialTranslations: EventTranslation[]
}

export function TranslationsClient({
  eventId,
  eventTitle,
  initialTranslations,
}: TranslationsClientProps) {
  const [translations, setTranslations] = useState(initialTranslations)
  const [isPending, startTransition] = useTransition()
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states
  const [selectedLang, setSelectedLang] = useState(PRESET_LANGUAGES[0]?.code ?? 'es')
  const [customLangName, setCustomLangName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [whatToBring, setWhatToBring] = useState('')
  const [eligibility, setEligibility] = useState('')
  const [isMachineTranslated, setIsMachineTranslated] = useState(false)

  const handleOpenAdd = () => {
    setTitle('')
    setDescription('')
    setWhatToBring('')
    setEligibility('')
    setIsMachineTranslated(false)
    setShowAddModal(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim()) {
      toast.error('Title and description are required.')
      return
    }

    const preset = PRESET_LANGUAGES.find((l) => l.code === selectedLang)
    const langName = customLangName.trim() || (preset ? (preset.name.split(' (')[0] ?? preset.name) : selectedLang) || 'Language'

    startTransition(async () => {
      const res = await saveEventTranslation(eventId, {
        language_code: selectedLang,
        language_name: langName,
        title: title.trim(),
        description: description.trim(),
        what_to_bring: whatToBring.trim() || null,
        eligibility: eligibility.trim() || null,
        is_machine_translated: isMachineTranslated,
      })

      if (res.success && res.data) {
        setTranslations((prev) => {
          const filtered = prev.filter((t) => t.language_code !== res.data!.language_code)
          return [...filtered, res.data!]
        })
        setShowAddModal(false)
        toast.success(`Translation saved for ${langName}!`)
      } else {
        toast.error(res.error || 'Failed to save translation.')
      }
    })
  }

  const handleDelete = (translationId: string, langName: string) => {
    if (!confirm(`Delete translation for ${langName}?`)) return

    startTransition(async () => {
      const res = await deleteEventTranslation(eventId, translationId)
      if (res.success) {
        setTranslations((prev) => prev.filter((t) => t.id !== translationId))
        toast.success('Translation deleted.')
      } else {
        toast.error(res.error || 'Failed to delete translation.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/events`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[--text-muted] hover:text-[--text-primary] mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard Events
          </Link>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight flex items-center gap-2">
            <Languages className="h-6 w-6 text-blue-600" />
            <span>Multi-Language Event Content</span>
          </h1>
          <p className="text-xs text-[--text-secondary] mt-0.5">
            Manage translations for <span className="font-semibold text-[--text-primary]">{eventTitle}</span>
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          size="sm"
          className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
        >
          <Plus className="h-4 w-4" />
          <span>Add Language Translation</span>
        </Button>
      </div>

      {/* Translations Roster */}
      {translations.length === 0 ? (
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-10 text-center space-y-3">
          <Globe className="h-10 w-10 text-[--text-muted] mx-auto opacity-50" />
          <h3 className="font-semibold text-sm text-[--text-primary]">No Translations Added</h3>
          <p className="text-xs text-[--text-secondary] max-w-md mx-auto">
            Broaden your event&apos;s campus reach by offering descriptions in Spanish, French, Mandarin, Hindi, and more.
          </p>
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
          >
            Add First Translation
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {translations.map((trans) => (
            <div
              key={trans.id}
              className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[--text-primary]">
                      {trans.language_name}
                    </span>
                    <span className="rounded bg-[--bg-muted] px-1.5 py-0.5 font-mono text-[10px] text-[--text-muted] uppercase">
                      {trans.language_code}
                    </span>
                  </div>
                  <h4 className="font-semibold text-xs text-[--text-secondary] mt-1 line-clamp-1">
                    {trans.title}
                  </h4>
                </div>

                <div className="flex items-center gap-2">
                  {trans.is_machine_translated ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
                      <Bot className="h-3 w-3" />
                      Auto-Translated
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCircle2 className="h-3 w-3" />
                      Human Verified
                    </span>
                  )}
                  <Button
                    onClick={() => handleDelete(trans.id, trans.language_name)}
                    disabled={isPending}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <p className="text-xs text-[--text-secondary] line-clamp-3 leading-relaxed">
                {trans.description}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Translation Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Add Event Translation
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Language</Label>
                  <select
                    value={selectedLang}
                    onChange={(e) => setSelectedLang(e.target.value)}
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 text-xs text-zinc-900 dark:text-zinc-100"
                  >
                    {PRESET_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Display Name (Optional override)</Label>
                  <Input
                    value={customLangName}
                    onChange={(e) => setCustomLangName(e.target.value)}
                    placeholder="e.g. Français Canadien"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Translated Event Title *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Translated title"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Translated Description *</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Translated event summary and details"
                  rows={4}
                  required
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2.5 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">What to Bring (Translated)</Label>
                  <Input
                    value={whatToBring}
                    onChange={(e) => setWhatToBring(e.target.value)}
                    placeholder="e.g. Laptop, ID card"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Eligibility (Translated)</Label>
                  <Input
                    value={eligibility}
                    onChange={(e) => setEligibility(e.target.value)}
                    placeholder="e.g. Open to all engineering students"
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 border border-amber-200/80 dark:border-amber-900/40">
                <input
                  type="checkbox"
                  id="machine_trans"
                  checked={isMachineTranslated}
                  onChange={(e) => setIsMachineTranslated(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-600 h-4 w-4"
                />
                <Label htmlFor="machine_trans" className="text-xs text-amber-900 dark:text-amber-200 cursor-pointer">
                  Mark as machine-generated translation (alerts students that text was generated with automated translation tools)
                </Label>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
                >
                  Save Translation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
