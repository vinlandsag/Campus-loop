'use client'

import { useState, useTransition } from 'react'
import {
  CheckCircle2,
  XCircle,
  Building2,
  GraduationCap,
  Mail,
  Calendar,
  ExternalLink,
  Instagram,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { approveOrganizer, rejectOrganizer } from '@/app/actions/moderation.actions'
import type { PendingOrganizer } from '@/app/actions/moderation.actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface OrganizerApprovalQueueClientProps {
  initialOrganizers: PendingOrganizer[]
}

export function OrganizerApprovalQueueClient({
  initialOrganizers,
}: OrganizerApprovalQueueClientProps) {
  const [organizers, setOrganizers] = useState<PendingOrganizer[]>(initialOrganizers)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleApprove = (organizer: PendingOrganizer) => {
    startTransition(async () => {
      const result = await approveOrganizer(organizer.id)
      if (result.success) {
        setOrganizers((prev) => prev.filter((o) => o.id !== organizer.id))
        toast.success(`Approved "${organizer.full_name || organizer.email}".`, {
          description: 'The organizer can now create and publish campus events.',
        })
      } else {
        toast.error('Failed to approve organizer', {
          description: result.error,
        })
      }
    })
  }

  const handleReject = (organizer: PendingOrganizer) => {
    startTransition(async () => {
      const result = await rejectOrganizer(organizer.id, rejectReason || undefined)
      if (result.success) {
        setOrganizers((prev) => prev.filter((o) => o.id !== organizer.id))
        setRejectingId(null)
        setRejectReason('')
        toast.info(`Organizer request rejected.`, {
          description: `Account for "${organizer.full_name || organizer.email}" reverted to student role.`,
        })
      } else {
        toast.error('Failed to reject organizer', {
          description: result.error,
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      {organizers.length === 0 ? (
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
          <UserCheck className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
          <h3 className="font-display text-base font-bold text-[--text-primary]">
            All Clubs Reviewed
          </h3>
          <p className="mt-1 text-xs text-[--text-secondary]">
            There are no pending organizer verification requests at this time.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {organizers.map((org) => {
            const initials = org.full_name
              ? org.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2)
              : org.email.slice(0, 2).toUpperCase()

            const isRejecting = rejectingId === org.id

            return (
              <div
                key={org.id}
                className="flex flex-col gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-xs transition-all hover:border-[--border-default] md:flex-row md:items-start md:justify-between"
              >
                {/* Left: Info */}
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 shrink-0 border border-[--border-subtle]">
                    <AvatarImage src={org.avatar_url || undefined} alt={org.full_name || org.email} />
                    <AvatarFallback className="bg-[--accent-50] text-sm font-semibold text-[--accent-700]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-[--text-primary]">
                        {org.full_name || 'Unnamed Organizer'}
                      </h3>
                      <Badge variant="secondary" className="gap-1 text-[11px] font-medium">
                        <GraduationCap className="h-3 w-3" />
                        {org.campus_name || 'Campus'}
                      </Badge>
                      {org.campus_verification_status === 'verified' ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-medium border-0">
                          <ShieldCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                          Verified Campus Member
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-[10px] text-amber-600 border-amber-300">
                          <AlertTriangle className="h-3 w-3" />
                          Pending Domain Verification
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[--text-secondary]">
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {org.email}
                      </span>
                      {org.college && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {org.college}
                          {org.department ? ` (${org.department})` : ''}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Registered {new Date(org.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {org.bio && (
                      <p className="mt-1 max-w-xl text-xs text-[--text-muted] leading-relaxed">
                        {org.bio}
                      </p>
                    )}

                    {(org.website_url || org.instagram_handle) && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-[--text-secondary]">
                        {org.website_url && (
                          <a
                            href={org.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[--accent-600] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Website
                          </a>
                        )}
                        {org.instagram_handle && (
                          <span className="inline-flex items-center gap-1 text-[--text-muted]">
                            <Instagram className="h-3 w-3" />
                            @{org.instagram_handle.replace(/^@/, '')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col items-end gap-2 shrink-0 md:min-w-[200px]">
                  {!isRejecting ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRejectingId(org.id)
                          setRejectReason('')
                        }}
                        disabled={isPending}
                        className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                      >
                        <XCircle className="mr-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(org)}
                        disabled={isPending}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve Club
                      </Button>
                    </div>
                  ) : (
                    <div className="w-full space-y-2 rounded-xl border border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/40 dark:bg-rose-950/20">
                      <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                        Confirm Rejection
                      </p>
                      <input
                        type="text"
                        placeholder="Reason (optional, sent to user)"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full rounded-md border border-[--border-default] bg-[--bg-surface] px-2.5 py-1 text-xs text-[--text-primary] focus:outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectingId(null)}
                          disabled={isPending}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReject(org)}
                          disabled={isPending}
                          className="h-7 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
