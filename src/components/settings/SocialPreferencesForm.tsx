'use client'

import React, { useState, useTransition } from 'react'
import { ShieldCheck, Users, Eye, Check, Loader2, Lock } from 'lucide-react'
import { updateUserSocialPreferences } from '@/app/actions/friends.actions'
import type { UserSocialPreferences, AttendanceVisibility } from '@/types'

interface SocialPreferencesFormProps {
  initialPrefs: UserSocialPreferences
}

export function SocialPreferencesForm({ initialPrefs }: SocialPreferencesFormProps) {
  const [shareAttendance, setShareAttendance] = useState(
    initialPrefs.share_attendance_with_friends
  )
  const [defaultVisibility, setDefaultVisibility] = useState<AttendanceVisibility>(
    initialPrefs.default_attendance_visibility
  )
  const [allowFriendRequests, setAllowFriendRequests] = useState(
    initialPrefs.allow_friend_requests
  )

  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    setError(null)
    setSaved(false)

    startTransition(async () => {
      const res = await updateUserSocialPreferences({
        share_attendance_with_friends: shareAttendance,
        default_attendance_visibility: defaultVisibility,
        allow_friend_requests: allowFriendRequests,
      })

      if (res.success) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(res.error || 'Failed to save preferences')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Attendance Sharing Switch */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-muted]/30 p-4 sm:p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <label
              htmlFor="share-attendance"
              className="text-sm font-semibold text-[--text-primary] cursor-pointer"
            >
              Share event attendance with mutual friends
            </label>
          </div>
          <p className="text-xs text-[--text-secondary] leading-relaxed max-w-lg">
            When enabled, mutual accepted friends who you have not blocked will see when you register
            for events that have visibility set to &ldquo;Friends&rdquo; or &ldquo;Public&rdquo;.
          </p>
          {!shareAttendance && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <Lock className="h-3 w-3" />
              <span>Strict Privacy: Your event RSVPs are completely private</span>
            </div>
          )}
        </div>

        <input
          id="share-attendance"
          type="checkbox"
          checked={shareAttendance}
          onChange={(e) => setShareAttendance(e.target.checked)}
          className="h-5 w-5 rounded border-[--border-default] text-[--primary] focus:ring-[--primary] mt-1 cursor-pointer"
        />
      </div>

      {/* Default Visibility Select */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-[--text-secondary]" />
          <label className="text-sm font-semibold text-[--text-primary]">
            Default Event Attendance Visibility
          </label>
        </div>
        <p className="text-xs text-[--text-secondary]">
          Choose the default privacy setting applied whenever you register for a new event.
        </p>

        <select
          value={defaultVisibility}
          onChange={(e) => setDefaultVisibility(e.target.value as AttendanceVisibility)}
          className="w-full max-w-md rounded-xl border border-[--border-default] bg-[--bg-input] px-3.5 py-2.5 text-sm text-[--text-primary] focus:border-[--primary] focus:outline-none focus:ring-1 focus:ring-[--primary]"
        >
          <option value="private">Private (Only you &amp; the event organizer)</option>
          <option value="friends">Friends (Mutual friends with consent)</option>
          <option value="public">Public (Visible to the campus community)</option>
        </select>
      </div>

      {/* Allow Friend Requests Switch */}
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-[--border-subtle] bg-[--bg-muted]/30 p-4 sm:p-5">
        <div className="space-y-1">
          <label
            htmlFor="allow-requests"
            className="text-sm font-semibold text-[--text-primary] cursor-pointer"
          >
            Allow friend requests
          </label>
          <p className="text-xs text-[--text-secondary] leading-relaxed max-w-lg">
            Allow campus peers who know your institutional email to send you friend requests.
            You can always decline or block any request.
          </p>
        </div>

        <input
          id="allow-requests"
          type="checkbox"
          checked={allowFriendRequests}
          onChange={(e) => setAllowFriendRequests(e.target.checked)}
          className="h-5 w-5 rounded border-[--border-default] text-[--primary] focus:ring-[--primary] mt-1 cursor-pointer"
        />
      </div>

      {/* Feedback & Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              <span>Social privacy preferences saved!</span>
            </span>
          )}
          {error && (
            <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
          )}
        </div>

        <button
          type="button"
          disabled={isPending}
          onClick={handleSave}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-xs font-semibold text-white hover:bg-amber-700 active:scale-98 transition-colors disabled:opacity-60 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600 cursor-pointer"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <ShieldCheck className="h-4 w-4" />
              <span>Save Social Settings</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
