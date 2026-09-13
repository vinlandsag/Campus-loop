'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Calendar,
  Search,
  Trash2,
  ExternalLink,
  Users,
  GraduationCap,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { DeleteEventDialog } from './DeleteEventDialog'
import type { AdminEvent } from '@/types'

interface EventManagementClientProps {
  initialEvents: AdminEvent[]
}

export function EventManagementClient({ initialEvents }: EventManagementClientProps) {
  const [events, setEvents] = useState<AdminEvent[]>(initialEvents)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'cancelled'>('all')
  const [eventToDelete, setEventToDelete] = useState<AdminEvent | null>(null)

  const filteredEvents = events.filter((evt) => {
    if (statusFilter !== 'all' && evt.status !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = evt.title.toLowerCase().includes(q)
      const matchOrg = evt.organizer_name.toLowerCase().includes(q)
      const matchCampus = (evt.campus_name || '').toLowerCase().includes(q)
      return matchTitle || matchOrg || matchCampus
    }
    return true
  })

  function handleEventDeleted(deletedEventId: string) {
    setEvents((prev) => prev.filter((e) => e.id !== deletedEventId))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
          Event Management & Moderation
        </h1>
        <p className="mt-1 text-sm text-[--text-secondary]">
          Inspect platform events, review attendee counts, and permanently delete non-compliant events with registration bypass.
        </p>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Status filter tabs */}
        <div className="flex rounded-lg border border-[--border-subtle] bg-[--bg-surface] p-1">
          {(['all', 'published', 'draft', 'cancelled'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[--bg-muted] text-[--text-primary] shadow-xs'
                  : 'text-[--text-muted] hover:text-[--text-primary]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
          <input
            type="text"
            placeholder="Search by title, organizer, campus..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-[--border-subtle] bg-[--bg-surface] py-2 pl-9 pr-3 text-sm text-[--text-primary] placeholder-[--text-muted] focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Events Table / List */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
          <Calendar className="h-10 w-10 text-[--text-muted]" />
          <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">No events found</h3>
          <p className="mt-1 text-xs text-[--text-muted]">
            {searchQuery ? 'Try another search query.' : 'No events match the selected filter.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]">
          <div className="divide-y divide-[--border-subtle]">
            {filteredEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex flex-col gap-4 p-5 transition-colors hover:bg-[--bg-subtle] sm:flex-row sm:items-center sm:justify-between"
              >
                {/* Left: Event details */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[--text-primary]">{evt.title}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        evt.status === 'published'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : evt.status === 'draft'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {evt.status}
                    </span>
                    <span className="rounded-full bg-[--bg-muted] px-2 py-0.5 text-[10px] text-[--text-muted]">
                      {evt.category}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[--text-secondary]">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[--text-muted]" />
                      Organizer: <strong>{evt.organizer_name}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <GraduationCap className="h-3.5 w-3.5 text-[--text-muted]" />
                      Campus: <strong>{evt.campus_name || 'All Campuses'}</strong>
                    </span>
                    <span className="flex items-center gap-1" suppressHydrationWarning>
                      <Calendar className="h-3.5 w-3.5 text-[--text-muted]" />
                      Date:{' '}
                      {evt.event_date
                        ? (() => {
                            try {
                              const d = format(parseISO(evt.event_date), 'MMM d, yyyy')
                              return evt.start_time ? `${d} · ${evt.start_time.slice(0, 5)}` : d
                            } catch {
                              return evt.event_date
                            }
                          })()
                        : 'No date set'}
                    </span>
                    <span className="font-medium text-amber-700 dark:text-amber-400">
                      {evt.registration_count} registered
                      {evt.capacity ? ` / ${evt.capacity} cap` : ''}
                    </span>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 sm:flex-shrink-0">
                  <Link
                    href={`/events/${evt.slug}`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg border border-[--border-subtle] px-3 py-1.5 text-xs font-semibold text-[--text-secondary] transition-colors hover:bg-[--bg-muted] hover:text-[--text-primary]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View Public
                  </Link>

                  <button
                    onClick={() => setEventToDelete(evt)}
                    className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 shadow-xs transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove Event
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Event Confirmation Modal */}
      {eventToDelete && (
        <DeleteEventDialog
          event={eventToDelete}
          isOpen={true}
          onClose={() => setEventToDelete(null)}
          onDeleted={handleEventDeleted}
        />
      )}
    </div>
  )
}
