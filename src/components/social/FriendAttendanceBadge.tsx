'use client'

import React from 'react'
import Image from 'next/image'
import { Users2, ShieldCheck } from 'lucide-react'
import type { ConsentedFriendAttendance } from '@/types'

interface FriendAttendanceBadgeProps {
  friendAttendance?: ConsentedFriendAttendance | null
  className?: string
  compact?: boolean
}

export function FriendAttendanceBadge({
  friendAttendance,
  className = '',
  compact = false,
}: FriendAttendanceBadgeProps) {
  if (!friendAttendance || friendAttendance.count === 0) {
    return null
  }

  const { count, friends } = friendAttendance
  const displayedFriends = friends.slice(0, 3)

  let label = ''
  if (count === 1) {
    label = `${displayedFriends[0]?.name || 'Friend'} is attending`
  } else if (count === 2) {
    label = `${displayedFriends[0]?.name || 'Friend'} & 1 other friend attending`
  } else {
    label = `${displayedFriends[0]?.name || 'Friend'} & ${count - 1} other friends attending`
  }

  return (
    <div
      className={`group/badge relative inline-flex items-center gap-1.5 rounded-full border border-indigo-200/80 bg-indigo-50/90 px-2.5 py-1 text-xs font-medium text-indigo-900 shadow-sm backdrop-blur-sm dark:border-indigo-800/60 dark:bg-indigo-950/70 dark:text-indigo-200 ${className}`}
      title="Consented mutual friend attendance"
    >
      <div className="flex -space-x-1.5 overflow-hidden">
        {displayedFriends.map((f, i) =>
          f.avatar_url ? (
            <Image
              key={f.id || i}
              src={f.avatar_url}
              alt={f.name}
              width={18}
              height={18}
              className="inline-block h-4.5 w-4.5 rounded-full ring-1.5 ring-white object-cover dark:ring-zinc-900"
            />
          ) : (
            <div
              key={f.id || i}
              className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-indigo-200 text-[10px] font-bold text-indigo-800 ring-1.5 ring-white dark:bg-indigo-800 dark:text-indigo-200 dark:ring-zinc-900"
            >
              {f.name.charAt(0).toUpperCase()}
            </div>
          )
        )}
      </div>

      <Users2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
      <span className={compact ? 'hidden sm:inline truncate max-w-[150px]' : 'truncate max-w-[200px]'}>
        {label}
      </span>
      <span
        title="Privacy Protected: Consented mutual friends only"
        className="inline-flex items-center text-indigo-500 hover:text-indigo-700 dark:hover:text-indigo-300"
      >
        <ShieldCheck className="h-3 w-3" />
      </span>
    </div>
  )
}
