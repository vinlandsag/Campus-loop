import Link from 'next/link'
import type { Metadata } from 'next'
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Building2,
  Award,
  ArrowLeft,
  Lock,
} from 'lucide-react'
import { verifyCertificatePublic } from '@/app/actions/certificate.actions'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { Badge } from '@/components/ui/badge'
import { APP_NAME } from '@/lib/constants'

interface VerifyCertificatePageProps {
  params: Promise<{ code: string }>
}

export async function generateMetadata({
  params,
}: VerifyCertificatePageProps): Promise<Metadata> {
  const { code } = await params
  return {
    title: `Verify Certificate ${code} | ${APP_NAME}`,
    description: 'Verify the authenticity and integrity of a CampusLoop student event certificate.',
  }
}

export default async function VerifyCertificatePage({
  params,
}: VerifyCertificatePageProps) {
  const { code } = await params
  const res = await verifyCertificatePublic(code)

  return (
    <SectionContainer as="div" className="py-12 max-w-2xl mx-auto space-y-8">
      <div>
        <Link
          href="/events"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[--text-secondary] hover:text-[--text-primary] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Events</span>
        </Link>
      </div>

      <div className="rounded-3xl border border-[--border-default] bg-[--bg-surface] p-6 sm:p-10 shadow-lg text-center space-y-6">
        {res.success && res.data && res.data.is_valid ? (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div className="space-y-1.5">
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 px-3 py-1 text-xs">
                Official Verified Certificate
              </Badge>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[--text-primary]">
                {res.data.certificate_title}
              </h1>
              <p className="text-xs text-[--text-secondary]">
                Cryptographically signed and registered on {APP_NAME}.
              </p>
            </div>

            <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-muted]/40 p-6 text-left space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-3 gap-1">
                <span className="text-[--text-muted]">Awarded To</span>
                <span className="font-bold text-sm text-[--text-primary]">
                  {res.data.recipient_name}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-3 gap-1">
                <span className="text-[--text-muted]">Event</span>
                <span className="font-semibold text-[--text-primary] flex items-center gap-1">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  {res.data.event_title}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-3 gap-1">
                <span className="text-[--text-muted]">Issuing Organization</span>
                <span className="font-medium text-[--text-primary] flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5 text-indigo-600" />
                  {res.data.issuer_name}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-3 gap-1">
                <span className="text-[--text-muted]">Event Date</span>
                <span className="font-medium text-[--text-primary] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-zinc-500" />
                  {res.data.event_date}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-3 gap-1">
                <span className="text-[--text-muted]">Certificate Code</span>
                <span className="font-mono font-bold text-amber-700 dark:text-amber-400">
                  {res.data.certificate_code}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <span className="text-[--text-muted]">Issue Timestamp</span>
                <span className="text-[--text-secondary]">
                  {new Date(res.data.issued_at).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50 p-3.5 flex items-center justify-center gap-2 text-[11px] text-[--text-muted]">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span>
                Minimal verification disclosure protects recipient privacy while providing public cryptographic proof.
              </span>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 shadow-sm">
              <XCircle className="h-9 w-9" />
            </div>

            <div className="space-y-1.5">
              <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 px-3 py-1 text-xs">
                Invalid or Unverified
              </Badge>
              <h1 className="font-display text-2xl font-bold tracking-tight text-[--text-primary]">
                Certificate Not Found
              </h1>
              <p className="text-xs text-[--text-secondary] max-w-md mx-auto">
                The certificate code <span className="font-mono font-bold">{code}</span> could not be verified. It may be invalid, revoked, or incorrectly entered.
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/events"
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-4 py-2 text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Browse Campus Events
              </Link>
            </div>
          </>
        )}
      </div>
    </SectionContainer>
  )
}
