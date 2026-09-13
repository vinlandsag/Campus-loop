'use client'

import React from 'react'
import {
  Award,
  CheckCircle2,
  Download,
  Printer,
  ShieldCheck,
  X,
  ExternalLink,
} from 'lucide-react'
import QRCode from 'qrcode'
import { APP_NAME } from '@/lib/constants'
import type { EventCertificate } from '@/types'

interface CertificateModalProps {
  isOpen: boolean
  onClose: () => void
  certificate: EventCertificate
}

export function CertificateModal({
  isOpen,
  onClose,
  certificate,
}: CertificateModalProps) {
  const [qrDataUrl, setQrDataUrl] = React.useState<string | null>(null)

  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${certificate.certificate_code}`
    : `/verify/${certificate.certificate_code}`

  React.useEffect(() => {
    if (verifyUrl) {
      QRCode.toDataURL(verifyUrl, { margin: 1, width: 120 })
        .then(setQrDataUrl)
        .catch(() => {})
    }
  }, [verifyUrl])

  if (!isOpen) return null

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-[--border-default] bg-[--bg-surface] p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Award className="h-4 w-4" />
          <span>Verified Achievement Document</span>
        </div>

        {/* Certificate Canvas / Print Container */}
        <div
          id="printable-certificate"
          className="my-6 rounded-2xl border-4 border-double border-amber-600/40 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950 p-6 sm:p-10 text-center space-y-5 shadow-inner"
        >
          {/* Header */}
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{APP_NAME} Official Verified Record</span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-wide text-zinc-900 dark:text-zinc-100 pt-2">
              {certificate.config?.title || 'Certificate of Participation'}
            </h2>
            <p className="text-xs text-zinc-500 italic">This is proudly presented to</p>
          </div>

          {/* Recipient */}
          <div className="py-2 border-b-2 border-amber-600/30 inline-block min-w-[240px]">
            <p className="font-serif text-2xl sm:text-3xl font-extrabold text-amber-900 dark:text-amber-200">
              {certificate.recipient_name}
            </p>
          </div>

          <p className="max-w-md mx-auto text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            for verified active participation and attendance in the campus activity
          </p>

          <h3 className="font-display text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">
            {certificate.event?.title || 'Campus Event'}
          </h3>

          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-amber-600/20 pt-6 mt-6 gap-4 text-left">
            {/* QR Code */}
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white p-1 shadow-sm border border-zinc-200 flex items-center justify-center h-16 w-16">
                {qrDataUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={qrDataUrl} alt="Verification QR Code" className="h-full w-full object-contain" />
                ) : (
                  <div className="h-full w-full bg-zinc-100 animate-pulse" />
                )}
              </div>
              <div className="text-[10px] text-zinc-500 space-y-0.5">
                <p className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                  {certificate.certificate_code}
                </p>
                <p>Scan to verify authenticity</p>
                <p>Issued: {new Date(certificate.issued_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Official Gold Seal Stamp */}
            <div className="flex items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-amber-500 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 shadow-sm">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <div className="text-[10px] text-zinc-500 text-right">
                <p className="font-bold text-zinc-800 dark:text-zinc-200">Tamper-Resistant</p>
                <p className="text-emerald-600 font-semibold">Verified Standing</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 dark:text-amber-400 hover:underline"
          >
            <span>Public Verification URL</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-[--border-default] bg-[--bg-surface] px-4 py-2 text-xs font-semibold text-[--text-primary] hover:bg-[--bg-muted] transition-colors shadow-sm"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print / PDF</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 active:scale-95 transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
