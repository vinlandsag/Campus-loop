'use client'

import { useState, useTransition } from 'react'
import {
  Users,
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ScanLine,
  Edit,
  Eye,
  Crown,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  addEventTeamMember,
  updateEventTeamMemberRole,
  removeEventTeamMember,
} from '@/app/actions/team.actions'
import type { EventTeamMember, EventTeamRole } from '@/types'

interface TeamManagementClientProps {
  eventId: string
  initialTeam: EventTeamMember[]
  currentUserRole: EventTeamRole | null
}

const ROLE_DESCRIPTIONS: Record<
  EventTeamRole,
  { label: string; badgeColor: string; icon: LucideIcon; description: string }
> = {
  owner: {
    label: 'Owner',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200',
    icon: Crown,
    description: 'Full control over event details, team members, questions, and cancellation.',
  },
  editor: {
    label: 'Editor',
    badgeColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200',
    icon: Edit,
    description: 'Can edit event details, manage questions, send announcements, and check in attendees.',
  },
  check_in_staff: {
    label: 'Check-in Staff',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200',
    icon: ScanLine,
    description: 'Scoped to the check-in scanner and attendee list. Cannot edit event details or settings.',
  },
  viewer: {
    label: 'Viewer',
    badgeColor: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200',
    icon: Eye,
    description: 'Read-only access to attendee list, metrics, and question responses.',
  },
}

export function TeamManagementClient({
  eventId,
  initialTeam,
  currentUserRole,
}: TeamManagementClientProps) {
  const [team, setTeam] = useState<EventTeamMember[]>(initialTeam)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteInput, setInviteInput] = useState('')
  const [inviteRole, setInviteRole] = useState<EventTeamRole>('check_in_staff')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const isOwner = currentUserRole === 'owner'

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await addEventTeamMember(eventId, inviteInput, inviteRole)
      if (result.success) {
        toast.success('Team member invited successfully!')
        setShowInviteModal(false)
        setInviteInput('')
        // Refresh local list
        setTeam((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            event_id: eventId,
            user_id: inviteInput,
            role: inviteRole,
            created_at: new Date().toISOString(),
            user: {
              display_name: inviteInput,
              email: inviteInput.includes('@') ? inviteInput : null,
            },
          },
        ])
      } else {
        setError(result.error || 'Failed to invite team member.')
      }
    })
  }

  const handleRoleChange = (memberId: string, newRole: EventTeamRole) => {
    startTransition(async () => {
      const result = await updateEventTeamMemberRole(eventId, memberId, newRole)
      if (result.success) {
        toast.success('Role updated!')
        setTeam((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
        )
      } else {
        toast.error('Failed to update role', { description: result.error })
      }
    })
  }

  const handleRemove = (memberId: string, name: string) => {
    if (!confirm(`Are you sure you want to remove "${name}" from this event team?`)) {
      return
    }

    startTransition(async () => {
      const result = await removeEventTeamMember(eventId, memberId)
      if (result.success) {
        toast.success('Member removed from team')
        setTeam((prev) => prev.filter((m) => m.id !== memberId))
      } else {
        toast.error('Failed to remove member', { description: result.error })
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header with Invite Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[--text-primary]">Event Team</h2>
          <p className="text-xs text-[--text-secondary]">
            Delegate check-in scanner duties or co-manage this event with scoped team roles.
          </p>
        </div>

        {isOwner && (
          <Button
            onClick={() => setShowInviteModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 self-start sm:self-auto"
            size="sm"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Role Explanations Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.entries(ROLE_DESCRIPTIONS) as [EventTeamRole, typeof ROLE_DESCRIPTIONS['owner']][]).map(
          ([roleKey, roleMeta]) => {
            const Icon = roleMeta.icon
            return (
              <div
                key={roleKey}
                className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-3 text-xs"
              >
                <div className="flex items-center gap-1.5 font-semibold text-[--text-primary]">
                  <Icon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  {roleMeta.label}
                </div>
                <p className="mt-1 text-[--text-secondary] leading-relaxed">
                  {roleMeta.description}
                </p>
              </div>
            )
          }
        )}
      </div>

      {/* Team Members List */}
      <div className="overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm">
        <div className="border-b border-[--border-subtle] px-5 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-[--text-muted]" />
            <span className="font-semibold text-sm text-[--text-primary]">
              {team.length} Team Members
            </span>
          </div>
        </div>

        <div className="divide-y divide-[--border-subtle]">
          {team.map((member) => {
            const isPrimary = member.id.startsWith('owner-')
            const roleMeta = ROLE_DESCRIPTIONS[member.role] || ROLE_DESCRIPTIONS.viewer
            const memberName = member.user?.display_name || 'Team Member'

            return (
              <div
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.user?.avatar_url || ''} />
                    <AvatarFallback className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-xs font-bold">
                      {memberName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-[--text-primary]">{memberName}</p>
                      {isPrimary && (
                        <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                          Creator
                        </span>
                      )}
                    </div>
                    {member.user?.email && (
                      <p className="text-xs text-[--text-secondary]">{member.user.email}</p>
                    )}
                  </div>
                </div>

                {/* Role & Actions */}
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {isOwner && !isPrimary ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleRoleChange(member.id, e.target.value as EventTeamRole)
                        }
                        disabled={isPending}
                        className="rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="editor">Editor</option>
                        <option value="check_in_staff">Check-in Staff</option>
                        <option value="viewer">Viewer</option>
                        <option value="owner">Owner</option>
                      </select>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(member.id, memberName)}
                        disabled={isPending}
                        className="h-8 w-8 p-0 text-[--text-muted] hover:text-rose-600"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className={roleMeta.badgeColor}>
                      {roleMeta.label}
                    </Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowInviteModal(false)}
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-[--text-primary]">Invite Team Member</h3>
            <p className="mt-1 text-xs text-[--text-secondary]">
              Delegate check-in or management without giving away full account ownership.
            </p>

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleInvite} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="invite-email" className="text-xs font-semibold">
                  Member Email or User ID
                </Label>
                <Input
                  id="invite-email"
                  type="text"
                  placeholder="e.g. volunteer@campus.edu"
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  required
                  className="mt-1 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="invite-role" className="text-xs font-semibold">
                  Assigned Role
                </Label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as EventTeamRole)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="check_in_staff">
                    Check-in Staff (Scanner & Attendance Only)
                  </option>
                  <option value="editor">Editor (Edit details & announcements)</option>
                  <option value="viewer">Viewer (Read-only)</option>
                  <option value="owner">Co-Owner (Full event control)</option>
                </select>
                <p className="mt-1 text-[11px] text-[--text-muted]">
                  {ROLE_DESCRIPTIONS[inviteRole].description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !inviteInput.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isPending ? 'Inviting...' : 'Invite to Team'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
