'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Award,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Save,
  AlertCircle,
  Copy,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { saveEventCertificateConfig } from '@/app/actions/certificate.actions'
import type { EventCertificateConfig, EventCertificate, CertificateEligibility } from '@/types'

interface CertificateSettingsClientProps {
  eventId: string
  eventTitle: string
  initialConfig: EventCertificateConfig | null
  issuedCertificates: EventCertificate[]
}

export function CertificateSettingsClient({
  eventId,
  eventTitle,
  initialConfig,
  issuedCertificates,
}: CertificateSettingsClientProps) {
  const [isEnabled, setIsEnabled] = useState(initialConfig?.is_enabled ?? true)
  const [eligibility, setEligibility] = useState<CertificateEligibility>(
    initialConfig?.eligibility ?? 'checked_in'
  )
  const [titleTemplate, setTitleTemplate] = useState(
    initialConfig?.title_template || 'Certificate of Participation'
  )
  const [issuerTitle, setIssuerTitle] = useState(
    initialConfig?.issuer_title || 'Lead Organizer'
  )
  const [customMessage, setCustomMessage] = useState(
    initialConfig?.custom_message || 'In recognition of successful participation in this campus event.'
  )
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const res = await saveEventCertificateConfig(eventId, {
        is_enabled: isEnabled,
        eligibility,
        title: titleTemplate,
        issuer_name: issuerTitle,
        description: customMessage,
      })

      if (res.success) {
        toast.success('Certificate configuration saved successfully!')
      } else {
        const errorMsg = !res.success ? res.error : 'Failed to save certificate configuration.'
        setError(errorMsg || 'Failed to save certificate configuration.')
      }
    })
  }

  const copyVerificationLink = (code: string) => {
    const url = `${window.location.origin}/verify/${code}`
    navigator.clipboard.writeText(url)
    toast.success('Verification URL copied to clipboard!')
  }

  return (
    <div className="space-y-8">
      {/* Configuration Card */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Award className="h-5 w-5 text-amber-600" />
          <h2 className="text-lg font-bold text-[--text-primary]">
            Certificate of Attendance & Completion
          </h2>
        </div>
        <p className="text-xs text-[--text-secondary] mb-6">
          Configure automated, tamper-resistant certificates for attendees of{' '}
          <span className="font-semibold text-[--text-primary]">{eventTitle}</span>.
        </p>

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Enable Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-[--border-subtle] bg-[--bg-muted]/50 p-4">
            <div>
              <Label htmlFor="cert-enable" className="text-sm font-semibold text-[--text-primary] cursor-pointer">
                Issue Certificates for this Event
              </Label>
              <p className="text-xs text-[--text-secondary]">
                When enabled, qualified attendees can view, download, and print their authenticated certificates.
              </p>
            </div>
            <input
              id="cert-enable"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Eligibility Rule */}
            <div>
              <Label htmlFor="cert-eligibility" className="text-xs font-semibold">
                Eligibility Requirement
              </Label>
              <select
                id="cert-eligibility"
                value={eligibility}
                onChange={(e) => setEligibility(e.target.value as CertificateEligibility)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="checked_in">
                  Checked-In Attendance Only (Recommended default)
                </option>
                <option value="registered">
                  Any Confirmed Registration
                </option>
              </select>
              <p className="mt-1 text-[11px] text-[--text-muted]">
                {eligibility === 'checked_in'
                  ? 'Only attendees who were scanned or checked in by staff receive certificates.'
                  : 'All registered attendees receive certificates regardless of attendance status.'}
              </p>
            </div>

            {/* Certificate Title */}
            <div>
              <Label htmlFor="cert-title" className="text-xs font-semibold">
                Certificate Title / Header
              </Label>
              <Input
                id="cert-title"
                type="text"
                value={titleTemplate}
                onChange={(e) => setTitleTemplate(e.target.value)}
                placeholder="e.g. Certificate of Participation, Certificate of Excellence"
                required
                className="mt-1 text-sm font-medium"
              />
            </div>

            {/* Issuer Designation */}
            <div>
              <Label htmlFor="cert-issuer" className="text-xs font-semibold">
                Issuer Title / Signoff
              </Label>
              <Input
                id="cert-issuer"
                type="text"
                value={issuerTitle}
                onChange={(e) => setIssuerTitle(e.target.value)}
                placeholder="e.g. Event Convener, Faculty Advisor, Club President"
                required
                className="mt-1 text-sm font-medium"
              />
            </div>

            {/* Custom Recognition Message */}
            <div className="sm:col-span-2">
              <Label htmlFor="cert-message" className="text-xs font-semibold">
                Recognition / Commendation Message
              </Label>
              <Input
                id="cert-message"
                type="text"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="e.g. For outstanding contribution and participation during the symposium."
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium"
            >
              <Save className="h-4 w-4" />
              {isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </div>

      {/* Issued Certificates Section */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm overflow-hidden">
        <div className="border-b border-[--border-subtle] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="font-semibold text-sm text-[--text-primary]">
              Issued Certificates Log
            </h3>
          </div>
          <span className="text-xs text-[--text-muted]">
            {issuedCertificates.length} {issuedCertificates.length === 1 ? 'certificate generated' : 'certificates generated'}
          </span>
        </div>

        {issuedCertificates.length === 0 ? (
          <div className="p-10 text-center text-xs text-[--text-muted]">
            <Users className="h-8 w-8 mx-auto text-[--text-muted] mb-2 opacity-50" />
            <p className="font-medium text-[--text-secondary]">No certificates claimed or issued yet.</p>
            <p className="mt-1">
              Attendees can generate and claim their certificates from My Events once eligible.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[--border-subtle] overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[--bg-muted] text-[--text-secondary] uppercase font-semibold">
                <tr>
                  <th className="px-6 py-3">Verification Code</th>
                  <th className="px-6 py-3">Recipient</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Issued Date</th>
                  <th className="px-6 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[--border-subtle]">
                {issuedCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-[--bg-muted]/40 transition-colors">
                    <td className="px-6 py-3.5 font-mono font-bold text-amber-600 dark:text-amber-400">
                      {cert.certificate_code}
                    </td>
                    <td className="px-6 py-3.5 font-medium text-[--text-primary]">
                      {cert.recipient_name}
                    </td>
                    <td className="px-6 py-3.5">
                      <Badge
                        variant="outline"
                        className={
                          cert.status === 'valid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                        }
                      >
                        {cert.status === 'valid' ? (
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                        ) : null}
                        {cert.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-6 py-3.5 text-[--text-muted]">
                      {new Date(cert.issued_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => copyVerificationLink(cert.certificate_code)}
                        title="Copy Public Verification Link"
                        className="p-1.5 rounded-lg border border-[--border-subtle] hover:bg-[--bg-muted] text-[--text-secondary]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <Link
                        href={`/verify/${cert.certificate_code}`}
                        target="_blank"
                        title="Open Public Verification Page"
                        className="p-1.5 inline-flex rounded-lg border border-[--border-subtle] hover:bg-[--bg-muted] text-[--text-secondary]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
