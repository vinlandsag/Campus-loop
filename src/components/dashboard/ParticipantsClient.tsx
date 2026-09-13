'use client'

import { useState, useMemo, useTransition } from 'react'
import { format, parseISO } from 'date-fns'
import Link from 'next/link'
import {
  Search,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  QrCode,
  UserCheck,
  Clock,
  CheckCircle2,
  Users,
  Percent,
  FileText,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { manualCheckInAttendee } from '@/app/actions/attendance.actions'
import { generateSafeCsv } from '@/lib/utils/csv'
import {
  canExportCSV,
  canCheckIn,
  canViewRegistrationAnswers,
} from '@/lib/auth/permissions'
import type { RegistrationQuestion, EventTeamRole } from '@/types'

type SortField = 'name' | 'date' | 'status'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'registered' | 'checked_in' | 'waitlisted' | 'cancelled'

export interface Participant {
  id: string
  userId?: string
  registered_at: string
  status: string
  ticket_code?: string | null
  checked_in_at?: string | null
  waitlist_position?: number | null
  answers?: Record<string, string>
  user: {
    full_name: string | null
    email: string
    avatar_url?: string | null
  }
}

interface ParticipantsClientProps {
  event: {
    id: string
    title: string
    slug: string
    capacity: number | null
  }
  initialParticipants: Participant[]
  questions?: RegistrationQuestion[]
  userRole?: EventTeamRole | null
}

export function ParticipantsClient({
  event,
  initialParticipants,
  questions = [],
  userRole = null,
}: ParticipantsClientProps) {
  const [participants, setParticipants] = useState<Participant[]>(initialParticipants)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [checkingInId, setCheckingInId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const canExport = canExportCSV(userRole)
  const canDoCheckIn = canCheckIn(userRole)
  const canViewAnswers = canViewRegistrationAnswers(userRole)

  // Manual Check In Handler
  const handleManualCheckIn = (participantId: string) => {
    setCheckingInId(participantId)
    startTransition(async () => {
      const result = await manualCheckInAttendee(event.id, participantId)
      setCheckingInId(null)

      if (result.success) {
        if (result.alreadyCheckedIn) {
          toast.info('Already checked in', {
            description: `${result.attendeeName} was previously checked in.`,
          })
        } else {
          toast.success('Attendee checked in!', {
            description: `${result.attendeeName} has been admitted.`,
          })
        }

        // Update local state
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId
              ? {
                  ...p,
                  status: 'checked_in',
                  checked_in_at: result.checkedInAt || new Date().toISOString(),
                }
              : p
          )
        )
      } else {
        toast.error('Check-in failed', {
          description: result.error,
        })
      }
    })
  }

  // Filter and sort
  const filteredAndSorted = useMemo(() => {
    let result = [...participants]

    // Status Filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'checked_in') {
        result = result.filter((p) => p.status === 'checked_in' || Boolean(p.checked_in_at))
      } else if (statusFilter === 'registered') {
        result = result.filter((p) => p.status === 'registered' && !p.checked_in_at)
      } else {
        result = result.filter((p) => p.status === statusFilter)
      }
    }

    // Search (searches name, email, ticket code, and custom answers)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((p) => {
        const nameMatch = p.user.full_name?.toLowerCase().includes(q)
        const emailMatch = p.user.email.toLowerCase().includes(q)
        const ticketMatch = p.ticket_code?.toLowerCase().includes(q)

        let answerMatch = false
        if (p.answers) {
          answerMatch = Object.values(p.answers).some((ans) =>
            String(ans).toLowerCase().includes(q)
          )
        }

        return nameMatch || emailMatch || ticketMatch || answerMatch
      })
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name': {
          const nameA = a.user.full_name || ''
          const nameB = b.user.full_name || ''
          comparison = nameA.localeCompare(nameB)
          break
        }
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'date':
          comparison = new Date(a.registered_at).getTime() - new Date(b.registered_at).getTime()
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })

    return result
  }, [participants, searchQuery, statusFilter, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  // Safe CSV Export with formula injection prevention and dynamic question columns
  const handleExportCSV = () => {
    // Dynamic question columns
    const questionHeaders = questions.map((q) => q.question_text)
    const baseHeaders = [
      'Name',
      'Email',
      'Ticket Code',
      'Status',
      'Waitlist Position',
      'Registered At',
      'Checked In At',
    ]
    const allHeaders = [...baseHeaders, ...questionHeaders]

    const rows = filteredAndSorted.map((p) => {
      let dateStr = p.registered_at
      try {
        dateStr = format(parseISO(p.registered_at), 'yyyy-MM-dd HH:mm:ss')
      } catch {}

      const baseRow: (string | number | null | undefined)[] = [
        p.user.full_name || '',
        p.user.email,
        p.ticket_code || '',
        p.status,
        p.waitlist_position || '',
        dateStr,
        p.checked_in_at || '',
      ]

      // Answers for each custom question
      const answerCols = questions.map((q) => p.answers?.[q.id] || '')

      return [...baseRow, ...answerCols]
    })

    const csvContent = generateSafeCsv(allHeaders, rows)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${event.slug}-attendees-safe.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Safe CSV exported successfully!')
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-2 h-4 w-4 text-[--text-muted]" />
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-[--accent-600]" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-[--accent-600]" />
    )
  }

  // Attendance metrics
  const totalRegistered = participants.filter(
    (p) => p.status === 'registered' || p.status === 'checked_in'
  ).length
  const totalCheckedIn = participants.filter(
    (p) => p.status === 'checked_in' || Boolean(p.checked_in_at)
  ).length
  const totalWaitlisted = participants.filter((p) => p.status === 'waitlisted').length
  const totalCancelled = participants.filter((p) => p.status === 'cancelled').length
  const attendanceRate =
    totalRegistered > 0 ? Math.round((totalCheckedIn / totalRegistered) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <Users className="h-3.5 w-3.5" />
            Registered
          </div>
          <p className="mt-2 text-2xl font-bold text-[--text-primary]">
            {totalRegistered}
            {event.capacity !== null && (
              <span className="text-sm font-normal text-[--text-muted]"> / {event.capacity}</span>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Checked In
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">
            {totalCheckedIn}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Waitlist
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">
            {totalWaitlisted}
          </p>
        </div>

        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <Percent className="h-3.5 w-3.5" />
            Turnout Rate
          </div>
          <p className="mt-2 text-2xl font-bold text-[--text-primary]">{attendanceRate}%</p>
        </div>
      </div>

      {participants.length === 0 ? (
        <EmptyState
          title="No participants yet"
          description="No one has registered for this event yet. Share the event link to get registrations."
          actionLabel="View Public Page"
          actionHref={`/events/${event.slug}`}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
          {/* Controls Bar & Filter Tabs */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Filter Tabs */}
              <div className="flex overflow-x-auto gap-1 text-xs">
                {(
                  [
                    { id: 'all', label: 'All', count: participants.length },
                    { id: 'registered', label: 'Registered', count: totalRegistered - totalCheckedIn },
                    { id: 'checked_in', label: 'Checked In', count: totalCheckedIn },
                    { id: 'waitlisted', label: 'Waitlist', count: totalWaitlisted },
                    { id: 'cancelled', label: 'Cancelled', count: totalCancelled },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors',
                      statusFilter === tab.id
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className="rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/events/${event.id}/check-in`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  <QrCode className="h-3.5 w-3.5" />
                  Scanner
                </Link>

                {canExport && (
                  <button
                    onClick={handleExportCSV}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-900 dark:text-zinc-100 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    title="Export injection-safe CSV with custom question answers"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Safe CSV
                  </button>
                )}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative mt-3 w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="Search by name, email, ticket code, or custom answer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/60 text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    <button onClick={() => handleSort('name')} className="flex items-center">
                      Attendee {renderSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    Ticket Code
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    <button onClick={() => handleSort('date')} className="flex items-center">
                      Registered {renderSortIcon('date')}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                    <button onClick={() => handleSort('status')} className="flex items-center">
                      Status {renderSortIcon('status')}
                    </button>
                  </th>
                  {canViewAnswers && (
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700 dark:text-zinc-300">
                      Custom Details
                    </th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold text-zinc-700 dark:text-zinc-300">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredAndSorted.map((reg) => {
                  let regDate = reg.registered_at
                  try {
                    regDate = format(parseISO(reg.registered_at), 'MMM d, yyyy h:mm a')
                  } catch {}

                  const isCheckedIn = reg.status === 'checked_in' || Boolean(reg.checked_in_at)
                  const isWaitlisted = reg.status === 'waitlisted'
                  const isCancelled = reg.status === 'cancelled'

                  const hasAnswers = reg.answers && Object.keys(reg.answers).length > 0

                  return (
                    <tr
                      key={reg.id}
                      className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 font-bold text-xs">
                            {reg.user.full_name?.charAt(0).toUpperCase() || 'A'}
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {reg.user.full_name || 'Attendee'}
                            </p>
                            {reg.user.email ? (
                              <p className="text-xs text-[--text-secondary]">{reg.user.email}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-mono text-xs text-[--text-muted]">
                        {reg.ticket_code || '—'}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-[--text-secondary]">
                        {regDate}
                      </td>

                      <td className="px-4 py-3">
                        {isCheckedIn ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Checked In
                            </span>
                            {reg.checked_in_at && (
                              <span className="text-[10px] text-[--text-muted]">
                                {new Date(reg.checked_in_at).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        ) : isWaitlisted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            <Clock className="h-3.5 w-3.5" />
                            Waitlist #{reg.waitlist_position ?? 1}
                          </span>
                        ) : isCancelled ? (
                          <span className="inline-flex rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                            Cancelled
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            Registered
                          </span>
                        )}
                      </td>

                      {/* Custom Answers Details */}
                      {canViewAnswers && (
                        <td className="px-4 py-3 text-xs">
                          {hasAnswers ? (
                            <div className="max-w-xs space-y-1">
                              {Object.entries(reg.answers!).map(([qId, ans]) => {
                                const qObj = questions.find((q) => q.id === qId)
                                const label = qObj?.question_text || 'Answer'
                                return (
                                  <div key={qId} className="truncate text-[11px]">
                                    <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                                      {label}:
                                    </span>{' '}
                                    <span className="text-zinc-600 dark:text-zinc-400">{ans}</span>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] text-[--text-muted]">—</span>
                          )}
                        </td>
                      )}

                      <td className="px-4 py-3 text-right">
                        {canDoCheckIn && !isCheckedIn && !isWaitlisted && !isCancelled && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleManualCheckIn(reg.id)}
                            disabled={checkingInId === reg.id}
                            className="h-8 gap-1 border-emerald-300 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            {checkingInId === reg.id ? 'Checking...' : 'Check In'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filteredAndSorted.length === 0 && (
              <div className="p-8 text-center text-[--text-muted]">
                No participants match your filter criteria.
              </div>
            )}
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden divide-y divide-[--border-subtle]">
            {filteredAndSorted.map((reg) => {
              const isCheckedIn = reg.status === 'checked_in' || Boolean(reg.checked_in_at)
              const isWaitlisted = reg.status === 'waitlisted'
              const isCancelled = reg.status === 'cancelled'
              const hasAnswers = reg.answers && Object.keys(reg.answers).length > 0

              return (
                <div key={reg.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-[--text-primary]">
                        {reg.user.full_name || 'Unknown'}
                      </p>
                      <p className="text-xs text-[--text-secondary]">{reg.user.email}</p>
                      {reg.ticket_code && (
                        <p className="mt-1 font-mono text-[10px] text-[--text-muted]">
                          {reg.ticket_code}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isCheckedIn ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Checked In
                        </span>
                      ) : isWaitlisted ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          Waitlist #{reg.waitlist_position ?? 1}
                        </span>
                      ) : isCancelled ? (
                        <span className="inline-flex rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                          Cancelled
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          Registered
                        </span>
                      )}

                      {canDoCheckIn && !isCheckedIn && !isWaitlisted && !isCancelled && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleManualCheckIn(reg.id)}
                          disabled={checkingInId === reg.id}
                          className="mt-1 h-7 text-xs border-emerald-300 text-emerald-700"
                        >
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Answers preview on mobile */}
                  {canViewAnswers && hasAnswers && (
                    <div className="rounded-lg bg-[--bg-muted] p-2.5 text-[11px] space-y-1">
                      <div className="flex items-center gap-1 font-semibold text-[--text-secondary]">
                        <FileText className="h-3 w-3" />
                        Attendee Details
                      </div>
                      {Object.entries(reg.answers!).map(([qId, ans]) => {
                        const qObj = questions.find((q) => q.id === qId)
                        return (
                          <div key={qId} className="truncate">
                            <span className="font-medium text-zinc-600 dark:text-zinc-400">
                              {qObj?.question_text || 'Detail'}:
                            </span>{' '}
                            <span>{ans}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}

            {filteredAndSorted.length === 0 && (
              <div className="p-8 text-center text-[--text-muted]">
                No participants match your filter criteria.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
