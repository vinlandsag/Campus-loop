'use client'

import { useState, useTransition } from 'react'
import {
  Eye,
  Users,
  Camera,
  Ban,
  Check,
  Loader2,
  Lock,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  updatePrivacyAndSocialSettings,
  unblockUser,
  type BlockedUserRecord,
} from '@/app/actions/settings.actions'
import type { UserSocialPreferences, AttendanceVisibility, PhotoPrivacyPreference } from '@/types'

interface PrivacyTabProps {
  socialPrefs: UserSocialPreferences
  photoPref: PhotoPrivacyPreference | null
  initialBlockedUsers: BlockedUserRecord[]
  onDirtyChange?: (isDirty: boolean) => void
}

export function PrivacyTab({
  socialPrefs,
  photoPref,
  initialBlockedUsers,
  onDirtyChange,
}: PrivacyTabProps) {
  const [defaultVisibility, setDefaultVisibility] = useState<AttendanceVisibility>(
    socialPrefs.default_attendance_visibility
  )
  const [shareAttendance, setShareAttendance] = useState(
    socialPrefs.share_attendance_with_friends
  )
  const [allowFriendRequests, setAllowFriendRequests] = useState(
    socialPrefs.allow_friend_requests
  )
  const [optOutPhotos, setOptOutPhotos] = useState(
    photoPref?.opt_out_photo_appearances ?? false
  )

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRecord[]>(initialBlockedUsers)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [savedSuccess, setSavedSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    startTransition(async () => {
      const res = await updatePrivacyAndSocialSettings({
        default_attendance_visibility: defaultVisibility,
        share_attendance_with_friends: shareAttendance,
        allow_friend_requests: allowFriendRequests,
        opt_out_photos: optOutPhotos,
      })

      if (res.success) {
        setSavedSuccess(true)
        onDirtyChange?.(false)
        toast.success('Privacy & social preferences updated!')
        setTimeout(() => setSavedSuccess(false), 3000)
      } else {
        toast.error(res.error || 'Failed to update privacy settings.')
      }
    })
  }

  const handleUnblock = async (userId: string) => {
    setUnblockingId(userId)
    try {
      const res = await unblockUser(userId)
      if (res.success) {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== userId))
        toast.success('User has been unblocked.')
      } else {
        toast.error(res.error || 'Failed to unblock user.')
      }
    } catch {
      toast.error('Failed to unblock user.')
    } finally {
      setUnblockingId(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Privacy &amp; Social Visibility
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Maintain control over who sees your event RSVPs, networking profile, and photo media rights.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Attendance Visibility Default */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
              <Eye className="h-4 w-4 text-indigo-600" />
              Default Attendance Visibility
            </h3>
            <p className="text-xs text-[--text-secondary] mt-0.5">
              The privacy level assigned whenever you register for an event. You can always override this on individual tickets.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Private */}
            <label
              className={`flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                defaultVisibility === 'private'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                  : 'border-[--border-subtle] bg-[--bg-surface] hover:bg-[--bg-muted]/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[--text-primary] flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-indigo-600" /> Private
                  </span>
                  <input
                    type="radio"
                    name="default_visibility"
                    value="private"
                    checked={defaultVisibility === 'private'}
                    onChange={() => {
                      setDefaultVisibility('private')
                      onDirtyChange?.(true)
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-[--text-secondary] leading-relaxed">
                  Only you and the verified event organizers can see that you are registered.
                </p>
              </div>
              <span className="mt-3 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Recommended for maximum privacy
              </span>
            </label>

            {/* Friends */}
            <label
              className={`flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                defaultVisibility === 'friends'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                  : 'border-[--border-subtle] bg-[--bg-surface] hover:bg-[--bg-muted]/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[--text-primary] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-600" /> Mutual Friends
                  </span>
                  <input
                    type="radio"
                    name="default_visibility"
                    value="friends"
                    checked={defaultVisibility === 'friends'}
                    onChange={() => {
                      setDefaultVisibility('friends')
                      onDirtyChange?.(true)
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-[--text-secondary] leading-relaxed">
                  Only mutual accepted friends on CampusLoop see that you are attending.
                </p>
              </div>
              <span className="mt-3 text-[10px] text-[--text-muted]">
                Requires mutual social consent
              </span>
            </label>

            {/* Public */}
            <label
              className={`flex flex-col justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                defaultVisibility === 'public'
                  ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-600'
                  : 'border-[--border-subtle] bg-[--bg-surface] hover:bg-[--bg-muted]/40'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-[--text-primary] flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-indigo-600" /> Public Roster
                  </span>
                  <input
                    type="radio"
                    name="default_visibility"
                    value="public"
                    checked={defaultVisibility === 'public'}
                    onChange={() => {
                      setDefaultVisibility('public')
                      onDirtyChange?.(true)
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-[11px] text-[--text-secondary] leading-relaxed">
                  Other attendees browsing the event can see your display name on the participant list.
                </p>
              </div>
              <span className="mt-3 text-[10px] text-[--text-muted]">
                Best for open networking
              </span>
            </label>
          </div>
        </div>

        {/* Social Consent Controls */}
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600" />
            Social Consent Controls
          </h3>

          <div className="space-y-4 divide-y divide-[--border-subtle]">
            {/* Share attendance */}
            <div className="flex items-start justify-between gap-4 pt-1">
              <div className="space-y-1">
                <label htmlFor="share_attendance" className="text-xs font-semibold text-[--text-primary] cursor-pointer">
                  Share event registrations with mutual friends
                </label>
                <p className="text-[11px] text-[--text-muted] max-w-lg leading-relaxed">
                  Allows friends to see events you are attending in their &ldquo;Friends Attending&rdquo; feed recommendations.
                </p>
              </div>
              <input
                id="share_attendance"
                type="checkbox"
                checked={shareAttendance}
                onChange={(e) => {
                  setShareAttendance(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Friend Requests */}
            <div className="flex items-start justify-between gap-4 pt-4">
              <div className="space-y-1">
                <label htmlFor="friend_requests" className="text-xs font-semibold text-[--text-primary] cursor-pointer">
                  Allow other campus students to send friend connection requests
                </label>
                <p className="text-[11px] text-[--text-muted] max-w-lg leading-relaxed">
                  When disabled, only students you initiate requests with can become mutual friends.
                </p>
              </div>
              <input
                id="friend_requests"
                type="checkbox"
                checked={allowFriendRequests}
                onChange={(e) => {
                  setAllowFriendRequests(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
              />
            </div>

            {/* Photo Privacy */}
            <div className="flex items-start justify-between gap-4 pt-4">
              <div className="space-y-1">
                <label htmlFor="opt_out_photos" className="text-xs font-semibold text-[--text-primary] cursor-pointer flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5 text-purple-600" />
                  Opt out of appearing in official campus event photo galleries
                </label>
                <p className="text-[11px] text-[--text-muted] max-w-lg leading-relaxed">
                  Notifies campus organizers and photographers that you do not consent to close-up inclusion in published highlight galleries.
                </p>
              </div>
              <input
                id="opt_out_photos"
                type="checkbox"
                checked={optOutPhotos}
                onChange={(e) => {
                  setOptOutPhotos(e.target.checked)
                  onDirtyChange?.(true)
                }}
                className="h-4 w-4 rounded border-zinc-300 text-purple-600 focus:ring-purple-500 mt-1 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Save Preferences Button */}
        <div className="flex items-center justify-between pt-1">
          {savedSuccess && (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Privacy preferences saved!
            </span>
          )}
          {!savedSuccess && <span />}

          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save Privacy Settings
          </Button>
        </div>
      </form>

      {/* Blocked Users Section */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
            <Ban className="h-4 w-4 text-red-500" />
            Blocked Users &amp; Protection
          </h3>
          <p className="text-xs text-[--text-secondary] mt-0.5">
            Blocked students cannot see your networking profile, send you contact requests, or view your mutual friend attendance.
          </p>
        </div>

        {blockedUsers.length === 0 ? (
          <div className="rounded-xl border border-[--border-subtle] bg-[--bg-muted]/30 p-6 text-center space-y-1">
            <UserCheck className="h-6 w-6 text-[--text-muted] mx-auto opacity-60" />
            <p className="text-xs font-medium text-[--text-primary]">No blocked accounts</p>
            <p className="text-[11px] text-[--text-muted]">Your connection network is completely open.</p>
          </div>
        ) : (
          <div className="divide-y divide-[--border-subtle] border rounded-xl border-[--border-subtle] overflow-hidden">
            {blockedUsers.map((u) => (
              <div key={u.id} className="p-3 sm:p-4 flex items-center justify-between gap-3 bg-[--bg-surface]">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {u.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[--text-primary] truncate">{u.full_name}</p>
                    <p className="text-[10px] text-[--text-muted]">Blocked on {new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblockingId === u.id}
                  className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  {unblockingId === u.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Unblock'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
