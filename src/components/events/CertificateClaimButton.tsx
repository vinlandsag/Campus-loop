'use client'

import React, { useState, useTransition } from 'react'
import { Award, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { issueOrGetCertificate } from '@/app/actions/certificate.actions'
import { CertificateModal } from '@/components/events/CertificateModal'
import type { EventCertificate } from '@/types'

interface CertificateClaimButtonProps {
  eventId: string
  eventTitle: string
  isCheckedIn?: boolean
  className?: string
}

export function CertificateClaimButton({
  eventId,
  eventTitle,
  className = '',
}: CertificateClaimButtonProps) {
  const [certificate, setCertificate] = useState<EventCertificate | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleClaimOrView = () => {
    if (certificate) {
      setIsOpen(true)
      return
    }

    startTransition(async () => {
      const res = await issueOrGetCertificate(eventId)
      if (res.success && res.data) {
        setCertificate(res.data)
        setIsOpen(true)
        toast.success('Certificate verified!', {
          description: `Tamper-resistant certificate ready for ${eventTitle}.`,
        })
      } else {
        const errorMsg = !res.success ? res.error : 'You may not meet attendance or eligibility criteria.'
        toast.error('Could not claim certificate', {
          description: errorMsg,
        })
      }
    })
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={handleClaimOrView}
        className={`inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors shadow-xs disabled:opacity-60 cursor-pointer ${className}`}
        title="View or download your verifiable attendance certificate"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
        ) : (
          <Award className="h-3.5 w-3.5 text-amber-600" />
        )}
        <span>{certificate ? 'View Certificate' : 'Claim Certificate'}</span>
      </button>

      {certificate && (
        <CertificateModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          certificate={certificate}
        />
      )}
    </>
  )
}
