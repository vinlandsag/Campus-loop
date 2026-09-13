'use client'

import React, { useState, useTransition } from 'react'
import Image from 'next/image'
import {
  UserPlus,
  Users,
  Check,
  X,
  UserX,
  Ban,
  ShieldCheck,
  Loader2,
  Mail,
  Clock,
} from 'lucide-react'
import {
  sendFriendRequest,
  respondToFriendRequest,
  removeFriend,
  blockUser,
} from '@/app/actions/friends.actions'
import type { FriendDetails } from '@/types'

interface FriendsManagementClientProps {
  friends: FriendDetails[]
  incomingRequests: FriendDetails[]
  outgoingRequests: FriendDetails[]
  initialTab?: string
}

export function FriendsManagementClient({
  friends: initialFriends,
  incomingRequests: initialIncoming,
  outgoingRequests: initialOutgoing,
  initialTab = 'friends',
}: FriendsManagementClientProps) {
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'add'>(
    initialTab as 'friends' | 'requests' | 'add'
  )
  const [friends, setFriends] = useState(initialFriends)
  const [incoming, setIncoming] = useState(initialIncoming)
  const [outgoing, setOutgoing] = useState(initialOutgoing)

  const [searchEmail, setSearchEmail] = useState('')
  const [addStatus, setAddStatus] = useState<{ success?: boolean; message?: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Handle Send Friend Request
  const handleSendRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchEmail.trim()) return

    setAddStatus(null)
    startTransition(async () => {
      const res = await sendFriendRequest(searchEmail)
      if (res.success) {
        setAddStatus({ success: true, message: 'Friend request sent successfully!' })
        setSearchEmail('')
      } else {
        setAddStatus({ success: false, message: res.error || 'Failed to send request' })
      }
    })
  }

  // Handle Respond (Accept / Decline)
  const handleRespond = (friendshipId: string, action: 'accept' | 'decline', friendDetail: FriendDetails) => {
    startTransition(async () => {
      const res = await respondToFriendRequest(friendshipId, action)
      if (res.success) {
        setIncoming((prev) => prev.filter((r) => r.friendship_id !== friendshipId))
        if (action === 'accept') {
          setFriends((prev) => [
            {
              ...friendDetail,
              status: 'accepted',
            },
            ...prev,
          ])
        }
      } else {
        alert(res.error || 'Failed to update request')
      }
    })
  }

  // Handle Remove Friend
  const handleRemove = (targetUserId: string, targetName: string) => {
    if (!confirm(`Are you sure you want to remove ${targetName} from your friends?`)) {
      return
    }

    startTransition(async () => {
      const res = await removeFriend(targetUserId)
      if (res.success) {
        setFriends((prev) => prev.filter((f) => f.friend_user_id !== targetUserId))
        setOutgoing((prev) => prev.filter((r) => r.friend_user_id !== targetUserId))
      } else {
        alert(res.error || 'Failed to remove friend')
      }
    })
  }

  // Handle Block User
  const handleBlock = (targetUserId: string, targetName: string) => {
    if (!confirm(`Block ${targetName}? They will not be able to send friend requests or see mutual attendance.`)) {
      return
    }

    startTransition(async () => {
      const res = await blockUser(targetUserId)
      if (res.success) {
        setFriends((prev) => prev.filter((f) => f.friend_user_id !== targetUserId))
        setIncoming((prev) => prev.filter((r) => r.friend_user_id !== targetUserId))
      } else {
        alert(res.error || 'Failed to block user')
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'friends'
              ? 'border-[--primary] text-[--primary]'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>My Friends ({friends.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'requests'
              ? 'border-[--primary] text-[--primary]'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Requests {incoming.length > 0 && `(${incoming.length})`}</span>
          {incoming.length > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-rose-500" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('add')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
            activeTab === 'add'
              ? 'border-[--primary] text-[--primary]'
              : 'border-transparent text-[--text-secondary] hover:text-[--text-primary]'
          }`}
        >
          <UserPlus className="h-4 w-4" />
          <span>Add Friend</span>
        </button>
      </div>

      {/* ── TAB 1: My Friends ─────────────────────────────────────────── */}
      {activeTab === 'friends' && (
        <div className="space-y-4">
          {friends.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-[--border-subtle] bg-[--bg-surface] p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="mt-4 font-display text-lg font-bold text-[--text-primary]">
                No friends added yet
              </h3>
              <p className="mt-1.5 max-w-md text-xs text-[--text-secondary] leading-relaxed">
                Connect with campus peers to coordinate event plans. Friends&apos; lists are private and never visible to third parties.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('add')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 active:scale-95 transition-colors shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                <span>Add Your First Friend</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {friends.map((friend) => (
                <div
                  key={friend.friendship_id}
                  className="flex flex-col justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm transition-all hover:border-[--border-default]"
                >
                  <div className="flex items-center gap-3.5">
                    {friend.avatar_url ? (
                      <Image
                        src={friend.avatar_url}
                        alt={friend.full_name}
                        width={44}
                        height={44}
                        className="h-11 w-11 rounded-full object-cover ring-2 ring-[--border-subtle]"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {friend.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h4 className="font-display font-bold text-sm text-[--text-primary]">
                        {friend.display_name || friend.full_name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                        <Check className="h-3 w-3" />
                        <span>Connected</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-[--border-subtle] pt-3 text-xs">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemove(friend.friend_user_id, friend.full_name)}
                      className="inline-flex items-center gap-1 text-[--text-muted] hover:text-rose-600 transition-colors"
                      title="Remove from friends"
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>Remove</span>
                    </button>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleBlock(friend.friend_user_id, friend.full_name)}
                      className="inline-flex items-center gap-1 text-[--text-muted] hover:text-rose-700 transition-colors"
                      title="Block user"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Block</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Requests ───────────────────────────────────────────── */}
      {activeTab === 'requests' && (
        <div className="space-y-8">
          {/* Incoming */}
          <div className="space-y-4">
            <h3 className="font-display text-base font-bold text-[--text-primary]">
              Incoming Requests ({incoming.length})
            </h3>
            {incoming.length === 0 ? (
              <p className="text-xs text-[--text-muted]">No pending incoming friend requests.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {incoming.map((req) => (
                  <div
                    key={req.friendship_id}
                    className="flex flex-col justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      {req.avatar_url ? (
                        <Image
                          src={req.avatar_url}
                          alt={req.full_name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-sm">
                          {req.full_name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h4 className="font-bold text-sm text-[--text-primary]">
                          {req.full_name}
                        </h4>
                        <p className="text-xs text-[--text-muted]">Sent you a request</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-[--border-subtle] pt-3">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRespond(req.friendship_id, 'accept', req)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 active:scale-95 transition-colors shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600 cursor-pointer disabled:opacity-60"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleRespond(req.friendship_id, 'decline', req)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[--border-subtle] bg-[--bg-muted] px-3 py-1.5 text-xs font-semibold text-[--text-secondary] hover:text-[--text-primary] transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="space-y-4 border-t border-[--border-subtle] pt-6">
            <h3 className="font-display text-base font-bold text-[--text-primary]">
              Outgoing Pending Requests ({outgoing.length})
            </h3>
            {outgoing.length === 0 ? (
              <p className="text-xs text-[--text-muted]">No pending outgoing friend requests.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {outgoing.map((req) => (
                  <div
                    key={req.friendship_id}
                    className="flex items-center justify-between rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-4 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs">
                        {req.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-[--text-primary]">{req.full_name}</h4>
                        <p className="text-[11px] text-[--text-muted]">Awaiting response</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRemove(req.friend_user_id, req.full_name)}
                      className="text-xs text-zinc-400 hover:text-rose-600 transition-colors"
                      title="Cancel Request"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Add Friend ─────────────────────────────────────────── */}
      {activeTab === 'add' && (
        <div className="max-w-xl space-y-6">
          <div className="rounded-3xl border border-[--border-subtle] bg-[--bg-surface] p-6 sm:p-8 shadow-sm">
            <h3 className="font-display text-lg font-bold text-[--text-primary]">
              Connect with a Campus Peer
            </h3>
            <p className="mt-1 text-xs text-[--text-secondary] leading-relaxed">
              Enter the student&apos;s campus email address to send a private friend request.
            </p>

            <form onSubmit={handleSendRequest} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[--text-primary] mb-1.5">
                  Student Campus Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
                  <input
                    type="email"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    placeholder="student@campus.edu"
                    required
                    className="w-full rounded-xl border border-[--border-default] bg-[--bg-input] pl-10 pr-4 py-2.5 text-sm text-[--text-primary] placeholder:text-[--text-muted] focus:border-[--primary] focus:outline-none focus:ring-1 focus:ring-[--primary]"
                  />
                </div>
              </div>

              {addStatus && (
                <div
                  className={`rounded-xl p-3 text-xs leading-relaxed ${
                    addStatus.success
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'border border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300'
                  }`}
                >
                  {addStatus.message}
                </div>
              )}

              <button
                type="submit"
                disabled={isPending || !searchEmail.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 active:scale-98 transition-colors disabled:opacity-60 shadow-sm dark:bg-amber-500 dark:hover:bg-amber-600 cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Send Friend Request</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Privacy FAQ */}
          <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/40 dark:border-indigo-950/50 dark:bg-indigo-950/20 p-5 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
            <div className="flex items-center gap-2 font-bold text-indigo-900 dark:text-indigo-100">
              <ShieldCheck className="h-4 w-4 text-indigo-600" />
              <span>How CampusLoop Protects Friend Privacy</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-indigo-800 dark:text-indigo-300 leading-relaxed text-[11px]">
              <li>Friendships are strictly pairwise. Nobody can enumerate your friend graph.</li>
              <li>Only mutual accepted friends can see events you choose to share.</li>
              <li>Sharing attendance is opt-in and turned off by default in Settings.</li>
              <li>You can block or remove connections at any time with zero notification to them.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
