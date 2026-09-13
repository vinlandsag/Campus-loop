'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  User,
  MapPin,
  Bell,
  Shield,
  KeyRound,
  Download,
  Briefcase,
  AlertTriangle,
} from 'lucide-react'
import { ProfileTab } from '@/components/settings/ProfileTab'
import { CampusTab } from '@/components/settings/CampusTab'
import { NotificationsTab } from '@/components/settings/NotificationsTab'
import { PrivacyTab } from '@/components/settings/PrivacyTab'
import { SecurityTab } from '@/components/settings/SecurityTab'
import { DataTab } from '@/components/settings/DataTab'
import { OrganizerWorkspaceTab } from '@/components/settings/OrganizerWorkspaceTab'
import type {
  Profile,
  Campus,
  CampusVerificationStatus,
  UserNotificationPreferences,
  UserSocialPreferences,
  PhotoPrivacyPreference,
  SecurityAuditLog,
  AccountDeletionRequest,
  OrganizerWorkspaceSettings,
  CampusVenue,
} from '@/types'
import type { BlockedUserRecord } from '@/app/actions/settings.actions'
import { cn } from '@/lib/utils'

export type SettingsTabId =
  | 'profile'
  | 'campus'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'data'
  | 'organizer'

interface SettingsClientProps {
  profile: Profile
  currentCampus: Campus | null
  campusStatus: CampusVerificationStatus
  pendingCampus: Campus | null
  exceptionReason: string | null
  verifiedAt: string | null
  campuses: Campus[]
  userEmail: string
  isEmailConfirmed: boolean
  notificationPrefs: UserNotificationPreferences
  socialPrefs: UserSocialPreferences
  photoPref: PhotoPrivacyPreference | null
  blockedUsers: BlockedUserRecord[]
  auditLogs: SecurityAuditLog[]
  deletionRequest: AccountDeletionRequest | null
  organizerWorkspace: OrganizerWorkspaceSettings | null
  venues: CampusVenue[]
}

export function SettingsClient({
  profile,
  currentCampus,
  campusStatus,
  pendingCampus,
  exceptionReason,
  verifiedAt,
  campuses,
  userEmail,
  isEmailConfirmed,
  notificationPrefs,
  socialPrefs,
  photoPref,
  blockedUsers,
  auditLogs,
  deletionRequest,
  organizerWorkspace,
  venues,
}: SettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const isOrganizer = profile.role === 'organizer'
  const isVerifiedOrganizer = isOrganizer && Boolean(profile.is_verified)

  const requestedTab = searchParams.get('tab') as SettingsTabId | null
  const validTabs = useMemo<SettingsTabId[]>(() => {
    return [
      'profile',
      'campus',
      'notifications',
      'privacy',
      'security',
      'data',
      ...(isVerifiedOrganizer ? (['organizer'] as SettingsTabId[]) : []),
    ]
  }, [isVerifiedOrganizer])

  const activeTab: SettingsTabId = requestedTab && validTabs.includes(requestedTab) ? requestedTab : 'profile'

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [, startTransition] = useTransition()

  const handleTabSelect = (tabId: SettingsTabId) => {
    if (tabId === activeTab) return

    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to switch tabs without saving?'
      )
      if (!confirmLeave) return
      setHasUnsavedChanges(false)
    }

    startTransition(() => {
      router.push(`/settings?tab=${tabId}`, { scroll: false })
    })
  }

  const TABS_CONFIG = [
    {
      id: 'profile' as SettingsTabId,
      label: 'Profile & Identity',
      icon: User,
      description: 'Personal details and public display',
    },
    {
      id: 'campus' as SettingsTabId,
      label: 'Campus & Eligibility',
      icon: MapPin,
      badge: campusStatus === 'verified' ? 'Verified' : 'Review',
      badgeColor: campusStatus === 'verified' ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300' : 'text-amber-700 bg-amber-100 dark:bg-amber-950/40 dark:text-amber-300',
      description: 'Institution membership & transfer',
    },
    {
      id: 'notifications' as SettingsTabId,
      label: 'Notifications',
      icon: Bell,
      description: 'Reminders, quiet hours & delivery',
    },
    {
      id: 'privacy' as SettingsTabId,
      label: 'Privacy & Social',
      icon: Shield,
      description: 'Attendance visibility & blocking',
    },
    {
      id: 'security' as SettingsTabId,
      label: 'Security & Access',
      icon: KeyRound,
      description: 'Password, sessions & audit log',
    },
    {
      id: 'data' as SettingsTabId,
      label: 'Data & Account',
      icon: Download,
      badge: deletionRequest ? 'Deletion Pending' : undefined,
      badgeColor: 'text-red-700 bg-red-100 dark:bg-red-950/40 dark:text-red-300',
      description: 'Export archive & closure',
    },
    ...(isVerifiedOrganizer
      ? [
          {
            id: 'organizer' as SettingsTabId,
            label: 'Organizer Workspace',
            icon: Briefcase,
            badge: 'Verified Club',
            badgeColor: 'text-indigo-700 bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300',
            description: 'Event templates & coordinator alerts',
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 p-3 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>You have unsaved changes in this section. Please save your work before leaving.</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar / Desktop Tab Navigation */}
        <aside className="lg:col-span-4 xl:col-span-3">
          {/* Mobile Tab Selector (Scrollable horizontally) */}
          <div className="lg:hidden mb-4 overflow-x-auto pb-2 scrollbar-none">
            <div
              role="tablist"
              aria-label="Settings sections"
              className="flex items-center gap-1.5 min-w-max p-1 bg-[--bg-surface] rounded-2xl border border-[--border-subtle]"
            >
              {TABS_CONFIG.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={isActive}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => handleTabSelect(tab.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap border',
                      isActive
                        ? 'border-[--accent-200] bg-[--accent-50] text-[--accent-700] shadow-sm'
                        : 'border-transparent text-[--text-secondary] hover:bg-[--bg-muted]'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{tab.label.split(' ')[0]}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Desktop Tab Buttons */}
          <nav
            role="tablist"
            aria-label="Settings navigation tabs"
            className="hidden lg:flex flex-col gap-1.5 p-2 rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm"
          >
            {TABS_CONFIG.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  onClick={() => handleTabSelect(tab.id)}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-xl text-left transition-all cursor-pointer group border',
                    isActive
                      ? 'border-[--accent-200] bg-[--accent-50] text-[--text-primary] shadow-sm'
                      : 'border-transparent text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                        isActive
                          ? 'bg-[--accent-100] text-[--accent-700]'
                          : 'bg-[--bg-muted] text-[--text-muted] group-hover:text-[--text-primary]'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{tab.label}</p>
                      <p
                        className={cn(
                          'text-[10px] truncate',
                          isActive ? 'text-[--accent-700]' : 'text-[--text-muted]'
                        )}
                      >
                        {tab.description}
                      </p>
                    </div>
                  </div>

                  {tab.badge && (
                    <span
                      className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 shrink-0',
                        isActive ? 'bg-[--accent-100] text-[--accent-700]' : tab.badgeColor
                      )}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Tab Content Panel */}
        <main
          className="lg:col-span-8 xl:col-span-9"
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'profile' && (
            <ProfileTab profile={profile} onDirtyChange={setHasUnsavedChanges} />
          )}

          {activeTab === 'campus' && (
            <CampusTab
              currentCampus={currentCampus}
              campusStatus={campusStatus}
              pendingCampus={pendingCampus}
              exceptionReason={exceptionReason}
              verifiedAt={verifiedAt}
              campuses={campuses}
              userEmail={userEmail}
              isOrganizer={isOrganizer}
            />
          )}

          {activeTab === 'notifications' && (
            <NotificationsTab
              initialPrefs={notificationPrefs}
              onDirtyChange={setHasUnsavedChanges}
            />
          )}

          {activeTab === 'privacy' && (
            <PrivacyTab
              socialPrefs={socialPrefs}
              photoPref={photoPref}
              initialBlockedUsers={blockedUsers}
              onDirtyChange={setHasUnsavedChanges}
            />
          )}

          {activeTab === 'security' && (
            <SecurityTab
              userEmail={userEmail}
              isEmailConfirmed={isEmailConfirmed}
              twoFactorEnabled={profile.two_factor_enabled ?? false}
              auditLogs={auditLogs}
            />
          )}

          {activeTab === 'data' && (
            <DataTab initialDeletionRequest={deletionRequest} />
          )}

          {activeTab === 'organizer' && isVerifiedOrganizer && (
            <OrganizerWorkspaceTab
              initialSettings={organizerWorkspace}
              venues={venues}
              onDirtyChange={setHasUnsavedChanges}
            />
          )}
        </main>
      </div>
    </div>
  )
}
