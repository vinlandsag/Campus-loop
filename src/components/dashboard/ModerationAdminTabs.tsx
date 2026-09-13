'use client'

import { useState } from 'react'
import { ShieldAlert, UserCheck } from 'lucide-react'
import type { ModerationReport } from '@/types'
import type { PendingOrganizer } from '@/app/actions/moderation.actions'
import { ModerationQueueClient } from './ModerationQueueClient'
import { OrganizerApprovalQueueClient } from './OrganizerApprovalQueueClient'

interface ModerationAdminTabsProps {
  initialReports: ModerationReport[]
  initialOrganizers: PendingOrganizer[]
}

export function ModerationAdminTabs({
  initialReports,
  initialOrganizers,
}: ModerationAdminTabsProps) {
  const [activeTab, setActiveTab] = useState<'organizers' | 'reports'>('organizers')

  const pendingReportsCount = initialReports.filter((r) => r.status === 'pending').length
  const pendingOrganizersCount = initialOrganizers.length

  return (
    <div className="space-y-6">
      {/* Top Tabs */}
      <div className="flex items-center gap-3 border-b border-[--border-subtle] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('organizers')}
          className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'organizers'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
              : 'bg-[--bg-surface] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-muted]'
          }`}
        >
          <UserCheck className="h-4 w-4" />
          <span>Organizer Approvals</span>
          {pendingOrganizersCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'organizers'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
              }`}
            >
              {pendingOrganizersCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'reports'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
              : 'bg-[--bg-surface] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-muted]'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Incident & Content Reports</span>
          {pendingReportsCount > 0 && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                activeTab === 'reports'
                  ? 'bg-rose-500 text-white'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              }`}
            >
              {pendingReportsCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'organizers' ? (
        <OrganizerApprovalQueueClient initialOrganizers={initialOrganizers} />
      ) : (
        <ModerationQueueClient initialReports={initialReports} />
      )}
    </div>
  )
}
