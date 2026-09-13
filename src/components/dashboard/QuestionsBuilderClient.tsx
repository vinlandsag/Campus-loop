'use client'

import { useState, useTransition } from 'react'
import {
  Plus,
  Trash2,
  Save,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { saveEventQuestions } from '@/app/actions/question.actions'
import type { RegistrationQuestion, QuestionType } from '@/types'

interface QuestionsBuilderClientProps {
  eventId: string
  initialQuestions: RegistrationQuestion[]
}

interface QuestionDraft {
  id?: string
  question_text: string
  question_type: QuestionType
  options: string[]
  is_required: boolean
  sort_order: number
}

export function QuestionsBuilderClient({
  eventId,
  initialQuestions,
}: QuestionsBuilderClientProps) {
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initialQuestions.map((q) => ({
      id: q.id,
      question_text: q.question_text,
      question_type: q.question_type,
      options: q.options || [],
      is_required: q.is_required,
      sort_order: q.sort_order,
    }))
  )
  const [isPending, startTransition] = useTransition()

  // Presets
  const addPreset = (preset: {
    question_text: string
    question_type: QuestionType
    options?: string[]
    is_required?: boolean
  }) => {
    const newQuestion: QuestionDraft = {
      id: `temp-${Date.now()}`,
      question_text: preset.question_text,
      question_type: preset.question_type,
      options: preset.options || [],
      is_required: preset.is_required || false,
      sort_order: questions.length,
    }
    setQuestions((prev) => [...prev, newQuestion])
    toast.info(`Added "${preset.question_text}"`)
  }

  const handleAddBlank = () => {
    const newQuestion: QuestionDraft = {
      id: `temp-${Date.now()}`,
      question_text: '',
      question_type: 'text',
      options: [],
      is_required: false,
      sort_order: questions.length,
    }
    setQuestions((prev) => [...prev, newQuestion])
  }

  const handleUpdate = (index: number, updates: Partial<QuestionDraft>) => {
    setQuestions((prev) => {
      const copy = [...prev]
      copy[index] = { ...copy[index]!, ...updates }
      return copy
    })
  }

  const handleRemove = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index))
  }

  const handleAddOption = (qIndex: number, optionVal: string) => {
    const trimmed = optionVal.trim()
    if (!trimmed) return
    setQuestions((prev) => {
      const copy = [...prev]
      const current = copy[qIndex]!
      if (!current.options.includes(trimmed)) {
        copy[qIndex] = { ...current, options: [...current.options, trimmed] }
      }
      return copy
    })
  }

  const handleRemoveOption = (qIndex: number, optIndex: number) => {
    setQuestions((prev) => {
      const copy = [...prev]
      const current = copy[qIndex]!
      copy[qIndex] = {
        ...current,
        options: current.options.filter((_, i) => i !== optIndex),
      }
      return copy
    })
  }

  const handleSave = () => {
    // Validate that question texts are not blank
    for (const q of questions) {
      if (!q.question_text.trim()) {
        toast.error('Question title cannot be empty')
        return
      }
      if (q.question_type === 'select' && q.options.length === 0) {
        toast.error(`Please add at least one option for "${q.question_text}"`)
        return
      }
    }

    startTransition(async () => {
      const result = await saveEventQuestions(eventId, questions)
      if (result.success) {
        toast.success('Registration questions saved!')
      } else {
        toast.error('Failed to save questions', { description: result.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[--text-primary]">
            Custom Registration Questions
          </h2>
          <p className="text-xs text-[--text-secondary]">
            Collect required or optional details from attendees during registration (e.g. department, dietary, team name).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlank}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Custom Question
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            size="sm"
          >
            <Save className="h-4 w-4" />
            {isPending ? 'Saving...' : 'Save Questions'}
          </Button>
        </div>
      </div>

      {/* Quick Add Presets Bar */}
      <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[--text-muted] uppercase tracking-wider mb-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Quick Add Common Presets
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              addPreset({
                question_text: 'Academic Department / Major',
                question_type: 'text',
              })
            }
            className="rounded-lg border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:border-emerald-500 transition-colors"
          >
            + Department / Major
          </button>

          <button
            type="button"
            onClick={() =>
              addPreset({
                question_text: 'Year of Study',
                question_type: 'select',
                options: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Graduate / Alumni'],
              })
            }
            className="rounded-lg border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:border-emerald-500 transition-colors"
          >
            + Year of Study
          </button>

          <button
            type="button"
            onClick={() =>
              addPreset({
                question_text: 'Dietary Requirements or Allergies',
                question_type: 'textarea',
              })
            }
            className="rounded-lg border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:border-emerald-500 transition-colors"
          >
            + Dietary Requirements
          </button>

          <button
            type="button"
            onClick={() =>
              addPreset({
                question_text: 'Team Name (if participating as a group)',
                question_type: 'text',
              })
            }
            className="rounded-lg border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:border-emerald-500 transition-colors"
          >
            + Team Name
          </button>

          <button
            type="button"
            onClick={() =>
              addPreset({
                question_text: 'I agree to the Campus Event Code of Conduct',
                question_type: 'checkbox',
                is_required: true,
              })
            }
            className="rounded-lg border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-medium text-[--text-primary] hover:border-emerald-500 transition-colors"
          >
            + Code of Conduct Consent
          </button>
        </div>
      </div>

      {/* Questions List */}
      {questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-10 text-center text-[--text-muted]">
          <HelpCircle className="h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 font-medium text-sm text-[--text-primary]">
            No custom registration questions configured.
          </p>
          <p className="mt-1 max-w-sm text-xs text-[--text-secondary]">
            Attendees will register with their standard account profile. Click a preset above or add a custom question if you need specific details.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddBlank}
            className="mt-4 gap-1.5"
          >
            <Plus className="h-4 w-4" /> Add Question
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div
              key={q.id || idx}
              className="relative rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    {idx + 1}
                  </span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {q.question_type}
                  </Badge>
                  {q.is_required && (
                    <Badge variant="destructive" className="text-[10px]">
                      Required
                    </Badge>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemove(idx)}
                  className="rounded p-1 text-[--text-muted] hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                  title="Remove question"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Form Row */}
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <Label className="text-xs font-semibold">Question Prompt</Label>
                  <Input
                    type="text"
                    value={q.question_text}
                    onChange={(e) => handleUpdate(idx, { question_text: e.target.value })}
                    placeholder="e.g. Dietary preferences, Year of graduation, T-shirt size..."
                    className="mt-1 text-sm font-medium"
                    required
                  />
                </div>

                <div className="sm:col-span-4">
                  <Label className="text-xs font-semibold">Answer Type</Label>
                  <select
                    value={q.question_type}
                    onChange={(e) =>
                      handleUpdate(idx, { question_type: e.target.value as QuestionType })
                    }
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="text">Short Text (Department, Team)</option>
                    <option value="select">Dropdown Choice (Year, Size)</option>
                    <option value="checkbox">Checkbox (Consent, Waiver)</option>
                    <option value="textarea">Multi-line Text (Dietary, Notes)</option>
                  </select>
                </div>
              </div>

              {/* If type is Select, Options editor */}
              {q.question_type === 'select' && (
                <div className="mt-4 rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-muted]/50 p-3">
                  <Label className="text-xs font-semibold">Dropdown Options</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {q.options.map((opt, optIdx) => (
                      <span
                        key={optIdx}
                        className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-zinc-800 border px-3 py-1 text-xs font-medium text-[--text-primary]"
                      >
                        {opt}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(idx, optIdx)}
                          className="text-[--text-muted] hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Input
                      id={`new-opt-${idx}`}
                      type="text"
                      placeholder="Add an option..."
                      className="h-8 max-w-xs text-xs"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const target = e.currentTarget
                          handleAddOption(idx, target.value)
                          target.value = ''
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        const input = document.getElementById(
                          `new-opt-${idx}`
                        ) as HTMLInputElement
                        if (input) {
                          handleAddOption(idx, input.value)
                          input.value = ''
                        }
                      }}
                    >
                      Add Option
                    </Button>
                  </div>
                </div>
              )}

              {/* Required Switch */}
              <div className="mt-4 flex items-center justify-between border-t border-[--border-subtle] pt-3">
                <label className="flex items-center gap-2 text-xs font-medium text-[--text-secondary] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={q.is_required}
                    onChange={(e) => handleUpdate(idx, { is_required: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Require attendees to answer before confirming registration
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
