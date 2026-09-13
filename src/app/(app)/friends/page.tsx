import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Compass, ShieldCheck, ArrowLeft, AlertCircle } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { FriendsManagementClient } from '@/components/social/FriendsManagementClient'
import { getFriendsList, getPendingFriendRequests } from '@/app/actions/friends.actions'
import { APP_NAME } from '@/lib/constants'

export const metadata: Metadata = {
  title: `Campus Friends & Connections — ${APP_NAME}`,
  description: 'Manage your campus friends and private peer-to-peer event coordination on CampusLoop.',
}

interface FriendsPageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/friends')
  }

  const resolvedParams = await searchParams
  const activeTab = resolvedParams.tab || 'friends'

  const [friendsRes, requestsRes] = await Promise.all([
    getFriendsList(),
    getPendingFriendRequests(),
  ])

  const isMigrationMissing =
    (!friendsRes.success && friendsRes.error?.includes('migration')) ||
    (!requestsRes.success && requestsRes.error?.includes('migration'))

  const friends = friendsRes.success && friendsRes.data ? friendsRes.data : []
  const incoming = requestsRes.success && requestsRes.data ? requestsRes.data.incoming : []
  const outgoing = requestsRes.success && requestsRes.data ? requestsRes.data.outgoing : []

  return (
    <SectionContainer as="div" className="py-8 space-y-8">
      {/* Migration Notice if tables are not yet created */}
      {isMigrationMissing && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm text-amber-800 dark:text-amber-100">
              Database Migration Required
            </p>
            <p className="leading-relaxed">
              The Phase 12 database migration (<code>supabase/migrations/20260912140000_phase12_social_discovery_and_privacy.sql</code>) has not been applied to your Supabase project yet.
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-300">
              Please copy and run the migration SQL file in your Supabase Dashboard SQL Editor to initialize the <code>public.friendships</code>, <code>public.club_follows</code>, and <code>public.user_social_preferences</code> tables.
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[--border-subtle] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/following"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[--text-secondary] hover:text-[--text-primary] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Social Feed</span>
            </Link>
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[--text-primary]">
            Campus Friends & Connections
          </h1>
          <p className="mt-1 text-sm text-[--text-secondary]">
            Coordinate campus events with verified friends. Private, peer-to-peer, and fully consented.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/following"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <Compass className="h-4 w-4 text-[--accent-500]" />
            <span>Following Feed</span>
          </Link>
          <Link
            href="/settings"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-surface] px-3.5 py-2 text-xs font-semibold text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary] transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Social Privacy Settings</span>
          </Link>
        </div>
      </div>

      {/* Main Client UI */}
      <FriendsManagementClient
        friends={friends}
        incomingRequests={incoming}
        outgoingRequests={outgoing}
        initialTab={activeTab}
      />
    </SectionContainer>
  )
}
