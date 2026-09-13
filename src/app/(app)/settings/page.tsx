import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { SectionContainer } from '@/components/shared/SectionContainer'
import { SettingsClient } from '@/components/settings/SettingsClient'
import { getUserCampusDetails, getActiveCampuses } from '@/app/actions/campus.actions'
import { getCampusVenues } from '@/app/actions/venue.actions'
import { getUserSocialPreferences } from '@/app/actions/friends.actions'
import { getPhotoPrivacyPreference } from '@/app/actions/gallery.actions'
import { getUserNotificationPreferences } from '@/lib/notifications/preferences'
import {
  getBlockedUsers,
  getSecurityAuditLogs,
  getAccountDeletionRequest,
  getOrganizerWorkspaceSettings,
} from '@/app/actions/settings.actions'
import type { Profile, CampusVerificationStatus } from '@/types'

export const metadata: Metadata = {
  title: 'Settings & Account Center — CampusLoop',
  description: 'Control your profile, campus verification, privacy, notifications, security, and data.',
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch full profile from public.profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/login')
  }

  // Parallel data fetching for instant response
  const [
    campusDetails,
    campuses,
    venuesRes,
    notificationPrefs,
    socialPrefs,
    photoPrefRes,
    blockedUsers,
    auditLogs,
    deletionRequest,
    organizerWorkspace,
  ] = await Promise.all([
    getUserCampusDetails(),
    getActiveCampuses(),
    getCampusVenues(profile.campus_id || undefined),
    getUserNotificationPreferences(user.id, supabase),
    getUserSocialPreferences(),
    getPhotoPrivacyPreference(),
    getBlockedUsers(),
    getSecurityAuditLogs(),
    getAccountDeletionRequest(),
    profile.role === 'organizer' ? getOrganizerWorkspaceSettings() : Promise.resolve(null),
  ])

  const venues = venuesRes.success && venuesRes.data ? venuesRes.data : []
  const photoPref = photoPrefRes.success ? photoPrefRes.data : null

  const isEmailConfirmed = Boolean(user.email_confirmed_at || user.confirmed_at)

  return (
    <SectionContainer className="py-8 md:py-12">
      <div className="mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-[--text-primary]">
          Account Center
        </h1>
        <p className="mt-1 text-xs md:text-sm text-[--text-secondary]">
          Manage your campus membership, privacy visibility, security credentials, and preferences.
        </p>
      </div>

      <Suspense fallback={<div className="h-96 rounded-2xl bg-[--bg-surface] animate-pulse" />}>
        <SettingsClient
          profile={profile as unknown as Profile}
          currentCampus={campusDetails?.campus || null}
          campusStatus={(campusDetails?.status as CampusVerificationStatus) || 'unverified'}
          pendingCampus={campusDetails?.pendingCampus || null}
          exceptionReason={campusDetails?.exceptionReason || null}
          verifiedAt={campusDetails?.verifiedAt || null}
          campuses={campuses}
          userEmail={user.email || profile.email || ''}
          isEmailConfirmed={isEmailConfirmed}
          notificationPrefs={notificationPrefs}
          socialPrefs={socialPrefs}
          photoPref={photoPref}
          blockedUsers={blockedUsers}
          auditLogs={auditLogs}
          deletionRequest={deletionRequest}
          organizerWorkspace={organizerWorkspace}
          venues={venues}
        />
      </Suspense>
    </SectionContainer>
  )
}
