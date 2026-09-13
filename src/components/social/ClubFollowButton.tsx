'use client'

import React, { useState, useTransition } from 'react'
import { Bell, BellOff, Check, UserPlus, Users, Loader2 } from 'lucide-react'
import { followClub, unfollowClub, toggleClubNotification } from '@/app/actions/follow.actions'

interface ClubFollowButtonProps {
  organizerId: string
  initialIsFollowing?: boolean
  initialNotify?: boolean
  initialFollowerCount?: number
  showFollowerCount?: boolean
  isVerified?: boolean
  isOwnProfile?: boolean
  className?: string
}

export function ClubFollowButton({
  organizerId,
  initialIsFollowing = false,
  initialNotify = true,
  initialFollowerCount = 0,
  showFollowerCount = true,
  isVerified = true,
  isOwnProfile = false,
  className = '',
}: ClubFollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [notify, setNotify] = useState(initialNotify)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [isPending, startTransition] = useTransition()
  const [isHovered, setIsHovered] = useState(false)

  const handleToggleFollow = () => {
    if (!isVerified || isOwnProfile) return

    const nextFollowing = !isFollowing
    setIsFollowing(nextFollowing)
    setFollowerCount((prev) => (nextFollowing ? prev + 1 : Math.max(0, prev - 1)))

    startTransition(async () => {
      if (nextFollowing) {
        const res = await followClub(organizerId, notify)
        if (!res.success) {
          // Revert optimistic update
          setIsFollowing(false)
          setFollowerCount((prev) => Math.max(0, prev - 1))
          alert(res.error || 'Failed to follow club')
        }
      } else {
        const res = await unfollowClub(organizerId)
        if (!res.success) {
          // Revert optimistic update
          setIsFollowing(true)
          setFollowerCount((prev) => prev + 1)
          alert(res.error || 'Failed to unfollow club')
        }
      }
    })
  }

  const handleToggleNotification = (e: React.MouseEvent) => {
    e.stopPropagation()
    const nextNotify = !notify
    setNotify(nextNotify)

    startTransition(async () => {
      const res = await toggleClubNotification(organizerId, nextNotify)
      if (!res.success) {
        setNotify(!nextNotify)
        alert(res.error || 'Failed to update notification preference')
      }
    })
  }

  if (isOwnProfile) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <span
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300"
          title="You are viewing your own club organizer profile"
        >
          Your Club Profile
        </span>
        {showFollowerCount && (
          <div
            className="inline-flex items-center gap-1 text-xs text-[--text-muted]"
            title={`${followerCount} students follow your club`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>
              {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
            </span>
          </div>
        )}
      </div>
    )
  }

  if (!isVerified) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500 cursor-not-allowed ${className}`}
        title="Only verified campus clubs can be followed"
      >
        <UserPlus className="h-3.5 w-3.5" />
        <span>Unverified Club</span>
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Follow / Unfollow Button */}
      <button
        type="button"
        disabled={isPending}
        onClick={handleToggleFollow}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all duration-200 disabled:opacity-60 cursor-pointer ${
          isFollowing
            ? isHovered
              ? 'border border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300'
              : 'border border-zinc-200 bg-zinc-50/90 text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
            : 'bg-amber-600 text-white hover:bg-amber-700 active:scale-95 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600'
        }`}
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isFollowing ? (
          isHovered ? (
            <>Unfollow</>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Following</span>
            </>
          )
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5 text-white" />
            <span className="text-white font-semibold">Follow Club</span>
          </>
        )}
      </button>

      {/* Bell Notification Preference Toggle when following */}
      {isFollowing && (
        <button
          type="button"
          disabled={isPending}
          onClick={handleToggleNotification}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[--border-subtle] transition-colors ${
            notify
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60'
              : 'bg-[--bg-surface] text-[--text-muted] hover:bg-[--bg-muted]'
          }`}
          title={
            notify
              ? 'Notifications active for new events from this club. Click to mute.'
              : 'Notifications muted for this club. Click to enable.'
          }
        >
          {notify ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        </button>
      )}

      {/* Follower Count */}
      {showFollowerCount && (
        <div
          className="inline-flex items-center gap-1 text-xs text-[--text-muted]"
          title={`${followerCount} students follow this club`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </span>
        </div>
      )}
    </div>
  )
}
