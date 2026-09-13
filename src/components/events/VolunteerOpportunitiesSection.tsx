'use client'

import { useState } from 'react'
import Link from 'next/link'
import { HeartHandshake, Clock, Award, Users, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { VolunteerApplyModal } from './VolunteerApplyModal'
import type { EventVolunteerRole, EventVolunteerSignup } from '@/types'

interface VolunteerOpportunitiesSectionProps {
  roles: EventVolunteerRole[]
  userSignups?: EventVolunteerSignup[]
  isLoggedIn: boolean
  onSignupComplete?: () => void
}

export function VolunteerOpportunitiesSection({
  roles,
  userSignups = [],
  isLoggedIn,
  onSignupComplete,
}: VolunteerOpportunitiesSectionProps) {
  const [selectedRole, setSelectedRole] = useState<EventVolunteerRole | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!roles || roles.length === 0) {
    return null
  }

  const signupMap = new Map<string, EventVolunteerSignup>()
  userSignups.forEach((s) => signupMap.set(s.role_id, s))

  const handleOpenApply = (role: EventVolunteerRole) => {
    setSelectedRole(role)
    setIsModalOpen(true)
  }

  const formatShiftTime = (startStr: string | null, endStr: string | null) => {
    if (!startStr) return 'Flexible / Coordinate with Lead'
    const start = new Date(startStr)
    const dateStr = start.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })
    const startHour = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    if (!endStr) return `${dateStr} at ${startHour}`
    const end = new Date(endStr)
    const endHour = end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return `${dateStr}, ${startHour} – ${endHour}`
  }

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-[--text-primary]">
              Volunteer Opportunities
            </h2>
            <p className="text-xs text-[--text-secondary]">
              Help make this event a success. Sign up for specific roles and shifts.
            </p>
          </div>
        </div>
        <span className="self-start sm:self-auto rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          {roles.length} {roles.length === 1 ? 'Role Available' : 'Roles Available'}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {roles.map((role) => {
          const signup = signupMap.get(role.id)
          const spotsLeft = role.available_spots ?? Math.max(0, role.capacity - (role.signup_count ?? 0))
          const isFull = spotsLeft <= 0

          return (
            <div
              key={role.id}
              className="flex flex-col justify-between rounded-xl border border-[--border-subtle] bg-[--bg-muted]/40 p-4 transition-all hover:border-amber-500/30"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-[--text-primary]">{role.title}</h3>
                  {signup ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        signup.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : signup.status === 'checked_in'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                          : signup.status === 'declined'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {signup.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
                      {signup.status === 'checked_in' && <Sparkles className="h-3 w-3" />}
                      {signup.status === 'pending' && <Clock className="h-3 w-3" />}
                      {signup.status === 'declined' && <AlertCircle className="h-3 w-3" />}
                      {signup.status === 'approved'
                        ? 'Approved'
                        : signup.status === 'checked_in'
                        ? 'Checked In'
                        : signup.status === 'declined'
                        ? 'Declined'
                        : 'Applied'}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                        isFull
                          ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      <Users className="h-3 w-3" />
                      {spotsLeft} of {role.capacity} open
                    </span>
                  )}
                </div>

                <div className="mt-2.5 space-y-1.5 text-xs text-[--text-secondary]">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span>{formatShiftTime(role.shift_start || null, role.shift_end || null)}</span>
                  </div>

                  {role.description && (
                    <p className="line-clamp-2 text-xs text-[--text-muted] pt-1">
                      {role.description}
                    </p>
                  )}

                  {role.required_skills && (
                    <div className="flex flex-wrap items-center gap-1 pt-1.5">
                      <Award className="h-3 w-3 text-amber-500 shrink-0" />
                      {role.required_skills
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((skill: string, sIdx: number) => (
                          <span
                            key={sIdx}
                            className="rounded-md bg-zinc-200/80 px-1.5 py-0.5 text-[10px] font-medium text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                          >
                            {skill}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[--border-subtle]">
                {signup ? (
                  <p className="text-center text-xs font-medium text-[--text-secondary]">
                    {signup.status === 'approved'
                      ? 'You are an approved volunteer for this shift.'
                      : signup.status === 'checked_in'
                      ? 'You are checked in for this shift.'
                      : signup.status === 'declined'
                      ? 'Your application was not selected.'
                      : 'Application under organizer review.'}
                  </p>
                ) : !isLoggedIn ? (
                  <Link
                    href="/login"
                    className="block w-full rounded-lg border border-[--border-subtle] bg-[--bg-surface] py-2 text-center text-xs font-semibold text-[--text-primary] hover:bg-[--bg-muted]"
                  >
                    Log in to Volunteer
                  </Link>
                ) : isFull ? (
                  <button
                    disabled
                    className="w-full rounded-lg bg-zinc-100 py-2 text-center text-xs font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed"
                  >
                    Shift Fully Booked
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenApply(role)}
                    className="w-full rounded-lg bg-amber-600 py-2 text-center text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700"
                  >
                    Apply for Shift
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <VolunteerApplyModal
        role={selectedRole}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          if (onSignupComplete) onSignupComplete()
        }}
      />
    </div>
  )
}
