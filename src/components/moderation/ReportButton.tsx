'use client'

import { useState } from 'react'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportModal } from '@/components/moderation/ReportModal'
import type { ModerationTargetType } from '@/types'

interface ReportButtonProps {
  targetType: ModerationTargetType
  targetId: string
  targetTitle: string
  className?: string
  variant?: 'outline' | 'ghost' | 'secondary'
  size?: 'sm' | 'default' | 'icon'
}

export function ReportButton({
  targetType,
  targetId,
  targetTitle,
  className,
  variant = 'ghost',
  size = 'sm',
}: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={className || 'gap-1.5 text-xs text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400'}
        title={`Report ${targetType === 'event' ? 'event' : 'organizer'}`}
      >
        <Flag className="h-3.5 w-3.5" />
        <span>Report</span>
      </Button>

      <ReportModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        targetType={targetType}
        targetId={targetId}
        targetTitle={targetTitle}
      />
    </>
  )
}
