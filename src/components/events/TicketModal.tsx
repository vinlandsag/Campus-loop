'use client'

import { useState, useSyncExternalStore, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  QrCode,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  Download,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { generateEventIcs } from '@/lib/calendar/ics'
import type { TicketData } from '@/types'

const emptySubscribe = () => () => {}

interface TicketModalProps {
  isOpen: boolean
  onClose: () => void
  ticket: TicketData
}

export function TicketModal({ isOpen, onClose, ticket }: TicketModalProps) {
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !isClient) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(ticket.ticketCode)
    setCopied(true)
    toast.success('Ticket code copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  const handleDownloadQR = () => {
    if (!ticket.qrDataUrl) return
    const a = document.createElement('a')
    a.href = ticket.qrDataUrl
    a.download = `ticket-${ticket.ticketCode}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('QR ticket downloaded!')
  }

  const handleDownloadCalendar = () => {
    try {
      const parts = ticket.eventStartsAt.split('•')
      const eventDate = (parts[0]?.trim() || new Date().toISOString().split('T')[0]) as string
      const startTime = parts[1]?.trim() || '10:00'
      const startHour = parseInt(startTime.slice(0, 2), 10) || 10
      const endTime = `${(startHour + 2).toString().padStart(2, '0')}:00`

      const ics = generateEventIcs({
        id: ticket.eventId,
        title: ticket.eventTitle,
        location: ticket.eventLocation,
        eventDate,
        startTime,
        endTime,
        organizerName: ticket.campusName || 'CampusLoop Event',
      })

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `event-${ticket.eventSlug || ticket.eventId}.ics`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Calendar event (.ics) downloaded!')
    } catch (err) {
      console.error('Failed to download calendar event:', err)
      toast.error('Could not generate calendar file.')
    }
  }

  const handleDownloadTicketPass = () => {
    try {
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>CampusLoop Admission Pass - ${ticket.eventTitle}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f4f4f5; margin: 0; padding: 40px 20px; display: flex; justify-content: center; }
    .ticket-card { background: #ffffff; border-radius: 16px; border: 1px solid #e4e4e7; max-width: 440px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.08); overflow: hidden; }
    .banner { background: linear-gradient(135deg, #059669, #0d9488); color: white; padding: 24px; text-align: left; }
    .banner h1 { margin: 8px 0 0 0; font-size: 22px; font-weight: 700; }
    .badge { display: inline-block; background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .content { padding: 28px 24px; text-align: center; }
    .qr-container { background: #fafafa; border: 2px dashed #e4e4e7; border-radius: 12px; padding: 20px; display: inline-block; margin: 0 auto; }
    .code { font-family: monospace; font-size: 16px; font-weight: bold; letter-spacing: 2px; color: #18181b; margin-top: 12px; }
    .details { text-align: left; margin-top: 24px; border-top: 1px solid #f4f4f5; padding-top: 16px; font-size: 13px; }
    .row { display: flex; justify-content: space-between; padding: 6px 0; }
    .label { color: #71717a; }
    .val { font-weight: 600; color: #18181b; }
    .footer { margin-top: 20px; font-size: 11px; color: #a1a1aa; border-top: 1px solid #f4f4f5; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="ticket-card">
    <div class="banner">
      <div class="badge">Valid CampusPass</div>
      <h1>${ticket.eventTitle}</h1>
      <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">${ticket.campusName || 'Campus Event'}</p>
    </div>
    <div class="content">
      <div class="qr-container">
        ${ticket.qrSvg ? ticket.qrSvg : (ticket.qrDataUrl ? `<img src="${ticket.qrDataUrl}" width="160" height="160" />` : '')}
        <div class="code">${ticket.ticketCode}</div>
      </div>
      <div class="details">
        <div class="row"><span class="label">Attendee:</span><span class="val">${ticket.attendeeName}</span></div>
        <div class="row"><span class="label">Date & Time:</span><span class="val">${ticket.eventStartsAt}</span></div>
        <div class="row"><span class="label">Location:</span><span class="val">${ticket.eventLocation}</span></div>
        <div class="row"><span class="label">Status:</span><span class="val">${ticket.status.toUpperCase()}</span></div>
      </div>
      <div class="footer">
        Tamper-proof HMAC verified pass. Present at check-in station upon arrival.
      </div>
    </div>
  </div>
</body>
</html>`

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${ticket.ticketCode}.html`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Printable ticket pass downloaded!')
    } catch (err) {
      console.error('Failed to download ticket pass:', err)
      toast.error('Could not generate ticket pass.')
    }
  }

  const isCheckedIn = ticket.status === 'checked_in'

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto print:p-0 print:overflow-visible"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity print:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Ticket Pass Container */}
      <div className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-2xl transition-all print:my-0 print:max-h-none print:max-w-none print:border-none print:shadow-none">
        {/* Top Decorative Banner */}
        <div className="relative shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 px-5 py-4 sm:px-6 sm:py-5 text-white">
          <button
            onClick={onClose}
            aria-label="Close ticket"
            className="absolute right-3.5 top-3.5 sm:right-4 sm:top-4 rounded-full bg-black/20 p-1.5 text-white hover:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white print:hidden"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-widest text-emerald-100">
              CampusLoop Admission Pass
            </span>
            {isCheckedIn ? (
              <Badge variant="outline" className="border-emerald-300 bg-emerald-500/30 text-white text-[10px] sm:text-xs">
                Checked In
              </Badge>
            ) : (
              <Badge variant="outline" className="border-white/30 bg-white/20 text-white text-[10px] sm:text-xs">
                Valid Ticket
              </Badge>
            )}
          </div>

          <h2 id="ticket-title" className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-white line-clamp-2">
            {ticket.eventTitle}
          </h2>

          {ticket.campusName && (
            <p className="mt-0.5 text-xs text-emerald-100 truncate">{ticket.campusName}</p>
          )}
        </div>

        {/* Scrollable Ticket Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 sm:space-y-5">
          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-default] p-4 sm:p-5">
            <div className="relative rounded-lg bg-white p-2.5 sm:p-3 shadow-inner">
              {ticket.qrSvg ? (
                <div
                  className="h-36 w-36 sm:h-44 sm:w-44 flex items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: ticket.qrSvg }}
                />
              ) : ticket.qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ticket.qrDataUrl}
                  alt={`QR code for ticket ${ticket.ticketCode}`}
                  className="h-36 w-36 sm:h-44 sm:w-44 object-contain"
                />
              ) : (
                <div className="flex h-36 w-36 sm:h-44 sm:w-44 items-center justify-center text-muted-foreground">
                  <QrCode className="h-14 w-14 sm:h-16 sm:w-16" />
                </div>
              )}
            </div>

            {/* Ticket Code with Copy */}
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-xs sm:text-sm font-bold tracking-wider text-[--text-default]">
                {ticket.ticketCode}
              </span>
              <button
                onClick={handleCopy}
                title="Copy ticket code"
                aria-label="Copy ticket code"
                className="rounded p-1 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-default] print:hidden"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>

            <p className="mt-1 text-center text-xs text-[--text-muted]">
              Scan or present code at check-in station
            </p>
          </div>

          {/* Event Details Grid */}
          <div className="space-y-2.5 sm:space-y-3 divide-y divide-[--border-subtle] text-sm">
            <div className="flex items-center gap-3 pt-1">
              <User className="h-4 w-4 text-[--text-muted] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[--text-muted]">Attendee</p>
                <p className="font-medium text-[--text-default] truncate">{ticket.attendeeName}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2.5 sm:pt-3">
              <Calendar className="h-4 w-4 text-[--text-muted] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[--text-muted]">Date & Time</p>
                <p className="font-medium text-[--text-default]">{ticket.eventStartsAt}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2.5 sm:pt-3">
              <MapPin className="h-4 w-4 text-[--text-muted] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[--text-muted]">Location</p>
                <p className="font-medium text-[--text-default]">{ticket.eventLocation}</p>
              </div>
            </div>
          </div>

          {/* Verification & Privacy Badges */}
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 px-3.5 py-2 text-xs text-[--text-secondary]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span>Attendance Visibility</span>
              </div>
              <span className="font-semibold capitalize text-[--text-primary]">
                {ticket.attendanceVisibility || 'Private'}
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>Tamper-proof HMAC signed. Tied to your CampusLoop account.</span>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex flex-col gap-2 print:hidden">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadTicketPass}
                className="flex-1 gap-1 text-xs"
                size="sm"
              >
                <Download className="h-3.5 w-3.5" />
                Download Pass
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadCalendar}
                className="flex-1 gap-1 text-xs"
                size="sm"
              >
                <Calendar className="h-3.5 w-3.5" />
                Add to Calendar
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePrint}
                className="flex-1 gap-1 text-xs"
                size="sm"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </Button>
              {ticket.qrDataUrl && (
                <Button
                  variant="outline"
                  onClick={handleDownloadQR}
                  className="flex-1 gap-1 text-xs"
                  size="sm"
                >
                  <Download className="h-3.5 w-3.5" />
                  Save QR
                </Button>
              )}
              <Button
                onClick={onClose}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs px-4"
                size="sm"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Done
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
