'use client'

import { useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TicketModal } from '@/components/events/TicketModal'
import type { TicketData } from '@/types'

interface MyEventTicketButtonProps {
  ticket: TicketData
}

export function MyEventTicketButton({ ticket }: MyEventTicketButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="gap-1.5 border-emerald-300 bg-emerald-50/50 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
      >
        <QrCode className="h-3.5 w-3.5" />
        View Ticket
      </Button>

      <TicketModal isOpen={isOpen} onClose={() => setIsOpen(false)} ticket={ticket} />
    </>
  )
}
