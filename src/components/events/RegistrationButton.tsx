'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  CheckCircle2,
  XCircle,
  Clock,
  CalendarClock,
  QrCode,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  registerForEvent,
  unregisterFromEvent,
  joinWaitlist,
  leaveWaitlist,
} from '@/app/(public)/events/[slug]/actions'
import { PaymentPortalModal } from '@/components/events/PaymentPortalModal'
import { TicketModal } from '@/components/events/TicketModal'
import { RegistrationQuestionsModal } from '@/components/events/RegistrationQuestionsModal'
import { TeamRegistrationModal } from '@/components/events/TeamRegistrationModal'
import type { TicketData, RegistrationQuestion, EventRegistrationTeam } from '@/types'

export type RegistrationState =
  | 'logged_out'
  | 'eligible'
  | 'registered'
  | 'checked_in'
  | 'waitlisted'
  | 'full'
  | 'cancelled'
  | 'ended'

interface RegistrationButtonProps {
  eventId: string
  slug: string
  state: RegistrationState
  waitlistPosition?: number | null
  ticket?: TicketData | null
  isPaid?: boolean
  price?: number | null
  questions?: RegistrationQuestion[]
  eventTitle?: string
  registrationMode?: 'individual' | 'team' | 'both'
  minTeamSize?: number
  maxTeamSize?: number
  userTeam?: EventRegistrationTeam | null
  initialTeamCode?: string
}

export function RegistrationButton({
  eventId,
  slug,
  state,
  waitlistPosition,
  ticket,
  isPaid = false,
  price = null,
  questions = [],
  eventTitle,
  registrationMode = 'individual',
  minTeamSize = 2,
  maxTeamSize = 4,
  userTeam = null,
  initialTeamCode = '',
}: RegistrationButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showTicketModal, setShowTicketModal] = useState(false)
  const [showQuestionsModal, setShowQuestionsModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(Boolean(initialTeamCode))
  const [teamModalMode, setTeamModalMode] = useState<'create' | 'join'>(
    initialTeamCode ? 'join' : 'create'
  )

  const executeRegistration = (answers?: Record<string, string>) => {
    startTransition(async () => {
      const result = await registerForEvent(eventId, slug, answers)
      if (result.success) {
        toast.success('Successfully registered!', {
          description: "We've secured your spot and issued your ticket.",
        })
      } else {
        toast.error('Registration failed', {
          description: result.error,
        })
      }
    })
  }

  const handleRegister = () => {
    if (state === 'logged_out') {
      router.push(`/signup?next=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }

    if (isPaid && price !== null && price > 0) {
      setShowPaymentModal(true)
      return
    }

    // If event has custom registration questions, collect answers first
    if (questions && questions.length > 0) {
      setShowQuestionsModal(true)
      return
    }

    if (confirm('Are you sure you want to register for this event?')) {
      executeRegistration()
    }
  }

  const handleJoinWaitlist = () => {
    if (state === 'logged_out') {
      router.push(`/signup?next=${encodeURIComponent(`/events/${slug}`)}`)
      return
    }

    startTransition(async () => {
      const result = await joinWaitlist(eventId, slug)
      if (result.success) {
        toast.success('Added to waitlist!', {
          description: `You are #${result.position} in line. We will notify you when a spot opens up.`,
        })
      } else {
        toast.error('Could not join waitlist', {
          description: result.error,
        })
      }
    })
  }

  const handleLeaveWaitlist = () => {
    if (confirm('Are you sure you want to leave the waitlist?')) {
      startTransition(async () => {
        const result = await leaveWaitlist(eventId, slug)
        if (result.success) {
          toast.success('Left the waitlist')
        } else {
          toast.error('Failed to leave waitlist', {
            description: result.error,
          })
        }
      })
    }
  }

  const handleUnregister = () => {
    if (
      confirm(
        'Are you sure you want to cancel your registration? Your spot will automatically be offered to the next waitlisted attendee.'
      )
    ) {
      startTransition(async () => {
        const result = await unregisterFromEvent(eventId, slug)
        if (result.success) {
          toast.success('Registration cancelled')
        } else {
          toast.error('Failed to cancel registration', {
            description: result.error,
          })
        }
      })
    }
  }

  const renderButtonContent = () => {
    switch (state) {
      case 'logged_out':
        return (
          <Button
            id="register-button"
            onClick={handleRegister}
            className="w-full text-base font-semibold"
            size="lg"
          >
            Sign up to Register
          </Button>
        )

      case 'eligible':
        if (registrationMode === 'team') {
          if (userTeam) {
            return (
              <div className="flex w-full flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-center dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  You are registered on team
                </span>
                <span className="text-base font-bold text-[--text-primary]">{userTeam.name}</span>
                <span className="text-xs text-[--text-muted]">
                  {userTeam.status === 'complete' ? 'Team requirements met!' : 'Team is still forming.'}
                </span>
              </div>
            )
          }

          return (
            <div className="flex w-full flex-col gap-2.5">
              <Button
                type="button"
                onClick={() => {
                  setTeamModalMode('create')
                  setShowTeamModal(true)
                }}
                className="w-full text-base font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                size="lg"
              >
                <Users className="h-5 w-5" />
                Create a Team
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTeamModalMode('join')
                  setShowTeamModal(true)
                }}
                className="w-full text-sm font-medium gap-2 border-[--border-subtle]"
                size="lg"
              >
                Join with Invite Code
              </Button>
            </div>
          )
        }

        if (registrationMode === 'both') {
          if (userTeam) {
            return (
              <div className="flex w-full flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-center dark:border-indigo-900/50 dark:bg-indigo-950/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                  Participating on team
                </span>
                <span className="text-base font-bold text-[--text-primary]">{userTeam.name}</span>
              </div>
            )
          }

          return (
            <div className="flex w-full flex-col gap-3">
              <Button
                onClick={handleRegister}
                disabled={isPending}
                className="w-full text-base font-semibold"
                size="lg"
              >
                {isPending
                  ? 'Registering...'
                  : isPaid && price
                    ? `Register Solo & Pay ₹${price.toFixed(2)}`
                    : 'Register Solo'}
              </Button>

              <div className="relative my-0.5">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-[--border-subtle]" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-[--bg-surface] px-2 text-[--text-muted]">Or join as a team</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTeamModalMode('create')
                    setShowTeamModal(true)
                  }}
                  className="gap-1 text-xs font-semibold"
                  size="sm"
                >
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  Create Team
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTeamModalMode('join')
                    setShowTeamModal(true)
                  }}
                  className="gap-1 text-xs font-semibold"
                  size="sm"
                >
                  Join Team
                </Button>
              </div>
            </div>
          )
        }

        return (
          <Button
            onClick={handleRegister}
            disabled={isPending}
            className="w-full text-base font-semibold"
            size="lg"
          >
            {isPending
              ? 'Registering...'
              : isPaid && price
                ? `Register & Pay ₹${price.toFixed(2)}`
                : 'Register Now'}
          </Button>
        )

      case 'registered':
      case 'checked_in':
        return (
          <div className="flex w-full flex-col gap-3">
            <div
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                state === 'checked_in'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300'
                  : 'border-green-200 bg-green-50 text-green-800 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="font-medium text-sm">
                  {state === 'checked_in' ? "You're checked in!" : "You're registered!"}
                </span>
              </div>
              {ticket && (
                <span className="font-mono text-xs font-semibold uppercase opacity-80">
                  {ticket.ticketCode.slice(-8)}
                </span>
              )}
            </div>

            {/* View Ticket Action */}
            {ticket && (
              <Button
                type="button"
                onClick={() => setShowTicketModal(true)}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                size="lg"
              >
                <QrCode className="h-5 w-5" />
                View Admission Ticket
              </Button>
            )}

            {state !== 'checked_in' && (
              <Button
                type="button"
                onClick={handleUnregister}
                disabled={isPending}
                variant="outline"
                className="w-full text-sm text-[--text-muted] hover:text-red-600"
              >
                {isPending ? 'Cancelling...' : 'Cancel Registration'}
              </Button>
            )}
          </div>
        )

      case 'waitlisted':
        return (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold text-sm">You are on the Waitlist</p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {waitlistPosition
                      ? `Position #${waitlistPosition} in queue`
                      : 'Waiting for an open spot'}
                  </p>
                </div>
              </div>
            </div>

            <Button
              type="button"
              onClick={handleLeaveWaitlist}
              disabled={isPending}
              variant="outline"
              className="w-full text-sm"
            >
              {isPending ? 'Leaving waitlist...' : 'Leave Waitlist'}
            </Button>
          </div>
        )

      case 'full':
        return (
          <div className="flex w-full flex-col gap-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-center text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              Event capacity reached. Join the waitlist to be automatically promoted if someone cancels.
            </div>
            <Button
              type="button"
              onClick={handleJoinWaitlist}
              disabled={isPending}
              className="w-full gap-2 bg-amber-600 hover:bg-amber-700 text-white text-base font-semibold"
              size="lg"
            >
              <Users className="h-5 w-5" />
              {isPending ? 'Joining Waitlist...' : 'Join Waitlist'}
            </Button>
          </div>
        )

      case 'cancelled':
        return (
          <Button disabled variant="destructive" className="w-full opacity-60" size="lg">
            <XCircle className="mr-2 h-5 w-5" />
            Event Cancelled
          </Button>
        )

      case 'ended':
        return (
          <Button disabled variant="outline" className="w-full" size="lg">
            <CalendarClock className="mr-2 h-5 w-5" />
            Event Ended
          </Button>
        )
    }
  }

  return (
    <>
      {renderButtonContent()}

      {/* Ticket Modal */}
      {ticket && (
        <TicketModal
          isOpen={showTicketModal}
          onClose={() => setShowTicketModal(false)}
          ticket={ticket}
        />
      )}

      {/* Registration Questions Modal */}
      {questions && questions.length > 0 && (
        <RegistrationQuestionsModal
          isOpen={showQuestionsModal}
          onClose={() => setShowQuestionsModal(false)}
          questions={questions}
          eventTitle={eventTitle || slug}
          onSubmit={(answers) => {
            setShowQuestionsModal(false)
            executeRegistration(answers)
          }}
          isSubmitting={isPending}
        />
      )}

      {/* Payment Modal */}
      {isPaid && price !== null && price > 0 && (
        <PaymentPortalModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={() => {
            setShowPaymentModal(false)
            executeRegistration()
          }}
          price={price}
          eventTitle={slug}
        />
      )}

      {/* Team Registration Modal */}
      {(registrationMode === 'team' || registrationMode === 'both') && (
        <TeamRegistrationModal
          isOpen={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          eventId={eventId}
          eventSlug={slug}
          eventTitle={eventTitle || slug}
          minTeamSize={minTeamSize}
          maxTeamSize={maxTeamSize}
          initialMode={teamModalMode}
          initialInviteCode={initialTeamCode}
        />
      )}
    </>
  )
}
