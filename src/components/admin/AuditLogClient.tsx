'use client'

import { useState } from 'react'
import {
  ScrollText,
  Shield,
  Clock,
  ChevronDown,
  ChevronRight,
  Filter,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { AdminAuditLogEntry } from '@/types'

interface AuditLogClientProps {
  initialEntries: AdminAuditLogEntry[]
}

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'organizer_approved', label: 'Organizer Approved' },
  { value: 'organizer_rejected', label: 'Organizer Rejected' },
  { value: 'organizer_suspended', label: 'Organizer Suspended' },
  { value: 'organizer_unsuspended', label: 'Organizer Unsuspended' },
  { value: 'organizer_revoked', label: 'Organizer Revoked' },
  { value: 'event_deleted', label: 'Event Deleted' },
  { value: 'campus_created', label: 'Campus Created' },
  { value: 'campus_updated', label: 'Campus Updated' },
  { value: 'domain_added', label: 'Domain Added' },
  { value: 'domain_removed', label: 'Domain Removed' },
  { value: 'campus_exception_approved', label: 'Campus Exception Approved' },
  { value: 'report_dismissed', label: 'Report Dismissed' },
  { value: 'report_investigated', label: 'Report Investigated' },
  { value: 'report_action_taken', label: 'Report Action Taken' },
]

export function AuditLogClient({ initialEntries }: AuditLogClientProps) {
  const [entries] = useState<AdminAuditLogEntry[]>(initialEntries)
  const [actionFilter, setActionFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filteredEntries = entries.filter((e) => {
    if (actionFilter && e.action !== actionFilter) return false
    return true
  })

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[--text-primary] sm:text-3xl">
            Admin Audit Log
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Immutable record of all administrative actions, organizer approvals, campus modifications, and moderation decisions.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 sm:self-auto">
          <Shield className="h-4 w-4" />
          Immutable Record (RLS Locked)
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-[--text-muted]" />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="rounded-lg border border-[--border-subtle] bg-[--bg-surface] px-3 py-1.5 text-xs font-medium text-[--text-primary] focus:border-amber-500 focus:outline-none"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="text-xs text-[--text-muted]">
          Showing {filteredEntries.length} of {entries.length} entries
        </span>
      </div>

      {/* Audit Log Entries */}
      {filteredEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
          <ScrollText className="h-10 w-10 text-[--text-muted]" />
          <h3 className="mt-3 text-sm font-semibold text-[--text-primary]">No audit log entries</h3>
          <p className="mt-1 text-xs text-[--text-muted]">
            {actionFilter
              ? 'No entries match the selected action filter.'
              : 'Audit log entries will appear here as administrative actions occur.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[--border-subtle] bg-[--bg-surface]">
          <div className="divide-y divide-[--border-subtle]">
            {filteredEntries.map((entry) => {
              const isExpanded = expandedId === entry.id
              const hasMetadata =
                entry.metadata &&
                typeof entry.metadata === 'object' &&
                Object.keys(entry.metadata).length > 0

              return (
                <div key={entry.id} className="p-4 transition-colors hover:bg-[--bg-subtle]">
                  <div
                    onClick={() => hasMetadata && toggleExpand(entry.id)}
                    className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                      hasMetadata ? 'cursor-pointer' : ''
                    }`}
                  >
                    {/* Left: Action & Target */}
                    <div className="flex items-start gap-3">
                      {hasMetadata ? (
                        <button
                          type="button"
                          className="mt-0.5 text-[--text-muted] transition-transform"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : (
                        <div className="w-4" />
                      )}

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ActionBadge action={entry.action} />
                          <span className="text-xs text-[--text-secondary]">
                            on <strong className="text-[--text-primary]">{entry.target_type}</strong>{' '}
                            <code className="rounded bg-[--bg-muted] px-1 py-0.5 font-mono text-[10px]">
                              {entry.target_id.slice(0, 8)}...
                            </code>
                          </span>
                        </div>

                        {entry.reason && (
                          <p className="mt-1 text-xs text-[--text-secondary]">
                            <span className="font-medium text-[--text-primary]">Reason:</span>{' '}
                            {entry.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: Date & Admin */}
                    <div className="flex items-center gap-3 text-xs text-[--text-muted] sm:flex-shrink-0">
                      <span className="flex items-center gap-1" suppressHydrationWarning>
                        <Clock className="h-3 w-3" />
                        {(() => {
                          try {
                            return format(parseISO(entry.created_at), 'MMM d, yyyy, h:mm a')
                          } catch {
                            return entry.created_at
                          }
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Metadata JSON */}
                  {isExpanded && hasMetadata && (
                    <div className="mt-3 ml-7 rounded-lg border border-[--border-subtle] bg-[--bg-base] p-3 text-xs font-mono text-[--text-secondary]">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[--text-muted]">
                        Snapshot Metadata
                      </p>
                      <pre className="overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(entry.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const isDestructive = action === 'event_deleted' || action === 'organizer_suspended' || action === 'organizer_revoked'
  const isSuccess = action === 'organizer_approved' || action === 'campus_exception_approved' || action === 'campus_created' || action === 'organizer_unsuspended'
  const isWarning = action === 'report_investigated' || action === 'domain_removed'

  if (isDestructive) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-300">
        {action.replace(/_/g, ' ')}
      </span>
    )
  }

  if (isSuccess) {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
        {action.replace(/_/g, ' ')}
      </span>
    )
  }

  if (isWarning) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
        {action.replace(/_/g, ' ')}
      </span>
    )
  }

  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      {action.replace(/_/g, ' ')}
    </span>
  )
}
