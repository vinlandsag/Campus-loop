'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { GraduationCap, Check, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { updateUserCampus } from '@/app/actions/campus.actions'
import type { Campus } from '@/types'
import { cn } from '@/lib/utils'

interface CampusSelectorProps {
  currentCampus?: Campus | null
  campuses: Campus[]
  className?: string
  variant?: 'navbar' | 'compact'
}

export function CampusSelector({
  currentCampus,
  campuses,
  className,
  variant = 'navbar',
}: CampusSelectorProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(currentCampus || null)

  const handleSelect = (campus: Campus) => {
    if (campus.id === selectedCampus?.id) return

    startTransition(async () => {
      const result = await updateUserCampus(campus.id)
      if (result.success) {
        setSelectedCampus(campus)
        toast.success(`Campus updated`, {
          description: `Now viewing events for ${campus.name}`,
        })
        router.refresh()
      } else {
        toast.error('Could not update campus', {
          description: result.error,
        })
      }
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className={cn(
          'flex items-center gap-1.5 rounded-full border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs font-medium text-[--text-primary] shadow-sm transition-colors hover:border-[--border-default] hover:bg-[--bg-muted] focus:outline-none focus:ring-2 focus:ring-[--accent-400]',
          variant === 'compact' && 'px-2.5 py-1 text-[11px]',
          className
        )}
        aria-label="Select your campus"
      >
        <GraduationCap className="h-3.5 w-3.5 text-[--accent-600]" />
        <span className="max-w-[140px] truncate sm:max-w-[200px]">
          {selectedCampus ? selectedCampus.name : 'Select Campus'}
        </span>
        <ChevronDown className="h-3 w-3 text-[--text-muted]" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64 max-h-80 overflow-y-auto">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="text-xs font-semibold text-[--text-secondary]">
            Choose Your Campus
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {campuses.map((campus) => {
            const isSelected = selectedCampus?.id === campus.id
            return (
              <DropdownMenuItem
                key={campus.id}
                onClick={() => handleSelect(campus)}
                className="flex items-center justify-between cursor-pointer py-2 text-xs"
              >
                <div className="flex flex-col">
                  <span className={cn('font-medium', isSelected && 'text-[--accent-600]')}>
                    {campus.name}
                  </span>
                  {campus.approved_domains && campus.approved_domains.length > 0 && (
                    <span className="text-[10px] text-[--text-muted]">
                      @{campus.approved_domains[0]}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="h-3.5 w-3.5 text-[--accent-600]" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
