'use client'

import { useState } from 'react'
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar'
import { DashboardMobileHeader } from '@/components/dashboard/DashboardMobileHeader'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Clock, AlertTriangle, Compass } from 'lucide-react'
import Link from 'next/link'
import type { CampusVerificationStatus } from '@/types'

interface DashboardShellProps {
  children: React.ReactNode
  user: {
    fullName: string
    email: string
    initials: string
    isOrganizer?: boolean
    isVerified?: boolean
    campusName?: string
    campusStatus?: CampusVerificationStatus
  }
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0c0a09] text-zinc-900 dark:text-zinc-100">
      <DashboardSidebar
        user={user}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="lg:pl-64 flex min-h-screen flex-col">
        <DashboardMobileHeader
          onMenuToggle={() => setMobileOpen((v) => !v)}
        />
        {/* Desktop Header */}
        <header className="hidden h-16 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 px-8 backdrop-blur-sm lg:flex sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              <span>Organizer Portal</span>
              <span>/</span>
              <span className="font-medium text-zinc-900 dark:text-zinc-100">Event Management</span>
            </div>

            {/* Verification Status Badges */}
            {user.isOrganizer && (
              <div className="flex items-center gap-2 pl-2">
                {user.isVerified ? (
                  <Badge className="gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-blue-500" />
                    <span>Verified Organizer</span>
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span>Pending Approval</span>
                  </Badge>
                )}

                {user.campusStatus === 'unverified' && (
                  <Badge variant="outline" className="gap-1 border-zinc-300 bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span>Campus Unverified</span>
                  </Badge>
                )}

                {user.campusStatus === 'pending' && (
                  <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs">
                    <Clock className="h-3 w-3 text-amber-500" />
                    <span>Campus Pending Review</span>
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/events"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 transition-colors"
            >
              <Compass className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              View Campus Events
            </Link>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
