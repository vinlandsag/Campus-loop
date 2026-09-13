'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, ArrowRight, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { updateUserCampus } from '@/app/actions/campus.actions'
import type { Campus } from '@/types'

interface CampusOnboardingModalProps {
  campuses: Campus[]
  userEmail?: string | null
}

export function CampusOnboardingModal({ campuses, userEmail }: CampusOnboardingModalProps) {
  const router = useRouter()
  const [selectedCampusId, setSelectedCampusId] = useState<string>(campuses[0]?.id || '')
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(true)

  const handleConfirm = () => {
    if (!selectedCampusId) return

    startTransition(async () => {
      const result = await updateUserCampus(selectedCampusId)
      if (result.success) {
        toast.success('Campus selected!', {
          description: `Welcome to your campus feed.`,
        })
        setIsOpen(false)
        router.refresh()
      } else {
        toast.error('Could not select campus', {
          description: result.error,
        })
      }
    })
  }

  if (!isOpen) return null

  const userDomain = userEmail?.split('@')[1]?.toLowerCase()
  const detectedCampus = campuses.find((c) =>
    c.approved_domains?.some((d) => d.toLowerCase() === userDomain)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200 whitespace-normal">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-2xl whitespace-normal break-words">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
          <GraduationCap className="h-6 w-6" />
        </div>

        <h2 className="mt-4 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Welcome to CampusLoop
        </h2>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-normal break-words">
          CampusLoop scopes your feed to verified campus events. Choose your campus to see what&apos;s
          happening around you.
        </p>

        {detectedCampus && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              We detected <strong>{detectedCampus.name}</strong> from your email domain.
            </span>
          </div>
        )}

        <div className="mt-5 space-y-2">
          <label htmlFor="campus-select" className="text-xs font-semibold text-[--text-primary]">
            Select Campus
          </label>
          <select
            id="campus-select"
            value={selectedCampusId}
            onChange={(e) => setSelectedCampusId(e.target.value)}
            className="w-full rounded-lg border border-[--border-default] bg-[--bg-surface] px-3 py-2 text-sm text-[--text-primary] focus:border-[--accent-400] focus:outline-none focus:ring-2 focus:ring-[--accent-200]"
          >
            {campuses.map((campus) => (
              <option key={campus.id} value={campus.id}>
                {campus.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isPending || !selectedCampusId}
            className="w-full gap-2 font-medium sm:w-auto"
          >
            <span>Confirm & Continue</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
