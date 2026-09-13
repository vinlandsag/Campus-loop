'use client'

import { useState, useTransition } from 'react'
import {
  Copy,
  Check,
  UserCheck,
  AlertCircle,
  LogOut,
  Crown,
  Share2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { leaveRegistrationTeam } from '@/app/actions/team-registration.actions'
import type { EventRegistrationTeam } from '@/types'

interface TeamRegistrationCardProps {
  team: EventRegistrationTeam
  eventSlug: string
  minTeamSize: number
  maxTeamSize: number
  currentUserId?: string
}

export function TeamRegistrationCard({
  team,
  eventSlug,
  minTeamSize,
  maxTeamSize,
  currentUserId,
}: TeamRegistrationCardProps) {
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  const memberCount = team.members?.length || team.member_count || 1
  const isComplete = team.status === 'complete' || memberCount >= minTeamSize
  const spotsNeededForMin = Math.max(0, minTeamSize - memberCount)
  const spotsLeftInTeam = Math.max(0, maxTeamSize - memberCount)

  const isLeader = currentUserId && team.leader_id === currentUserId

  const handleCopyInviteCode = () => {
    navigator.clipboard.writeText(team.invite_code)
    setCopied(true)
    toast.success('Invite code copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCopyInviteLink = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/events/${eventSlug}?team_code=${team.invite_code}`
    navigator.clipboard.writeText(link)
    toast.success('Direct team join link copied!')
  }

  const handleLeaveTeam = () => {
    const confirmMsg = isLeader
      ? 'Are you sure you want to leave your team? If other members remain, leadership will transfer. If you are the only member, the team will be disbanded.'
      : 'Are you sure you want to leave this team?'

    if (confirm(confirmMsg)) {
      startTransition(async () => {
        const res = await leaveRegistrationTeam(team.id, eventSlug)
        if (res.success) {
          toast.success(res.action === 'disbanded' ? 'Team disbanded' : 'Left the team')
        } else {
          toast.error('Failed to leave team', { description: res.error })
        }
      })
    }
  }

  return (
    <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[--border-subtle] pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Your Registered Team
            </span>
            {isComplete ? (
              <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                <UserCheck className="h-3 w-3" />
                Complete ({memberCount}/{maxTeamSize})
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 gap-1 text-[11px]">
                <AlertCircle className="h-3 w-3" />
                Forming ({memberCount}/{minTeamSize} min)
              </Badge>
            )}
          </div>
          <h3 className="mt-1 text-xl font-bold text-[--text-primary]">{team.name}</h3>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLeaveTeam}
          disabled={isPending}
          className="gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 self-start sm:self-auto"
        >
          <LogOut className="h-3.5 w-3.5" />
          {isPending ? 'Leaving...' : isLeader && memberCount === 1 ? 'Disband Team' : 'Leave Team'}
        </Button>
      </div>

      {/* Team Progress / Status Banner */}
      <div className="mt-4">
        {!isComplete ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">
              Team needs {spotsNeededForMin} more member{spotsNeededForMin === 1 ? '' : 's'} to confirm registration.
            </p>
            <p className="mt-0.5 text-amber-700 dark:text-amber-300">
              Share your team invite code with classmates. Once {minTeamSize} members join, your spots are locked and tickets are confirmed!
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-semibold">Team requirements met! You are confirmed for this event.</p>
            {spotsLeftInTeam > 0 && (
              <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
                You can still welcome up to {spotsLeftInTeam} more teammate{spotsLeftInTeam === 1 ? '' : 's'} (up to {maxTeamSize} max).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Invite Code Box */}
      <div className="mt-4 rounded-xl border border-dashed border-[--border-subtle] bg-[--bg-default] p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[--text-muted]">Team Invite Code</p>
            <span className="font-mono text-lg font-bold tracking-widest text-[--text-primary]">
              {team.invite_code}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInviteCode}
              className="gap-1.5 text-xs"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy Code'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInviteLink}
              className="gap-1.5 text-xs"
            >
              <Share2 className="h-3.5 w-3.5" />
              Copy Link
            </Button>
          </div>
        </div>
      </div>

      {/* Member Roster */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
          <span>Roster ({memberCount}/{maxTeamSize})</span>
          <span>Role</span>
        </div>

        <div className="mt-3 divide-y divide-[--border-subtle]">
          {team.members?.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.user?.avatar_url || ''} />
                  <AvatarFallback className="text-xs">
                    {(member.user?.display_name || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-[--text-primary] flex items-center gap-1.5">
                    {member.user?.display_name || 'Team Member'}
                    {member.user_id === currentUserId && (
                      <span className="text-[10px] text-emerald-600 font-semibold">(You)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-[--text-muted]">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {member.role === 'leader' ? (
                  <Badge variant="outline" className="border-amber-400/60 bg-amber-500/10 text-amber-700 dark:text-amber-300 gap-1 text-[10px]">
                    <Crown className="h-2.5 w-2.5 text-amber-500" />
                    Leader
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-[--border-subtle] text-[--text-muted] text-[10px]">
                    Member
                  </Badge>
                )}
                {member.status === 'confirmed' ? (
                  <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-[10px]">
                    Confirmed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-zinc-300 text-zinc-500 text-[10px]">
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
