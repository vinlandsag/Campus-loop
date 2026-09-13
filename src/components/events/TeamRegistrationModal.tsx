'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Users,
  UserPlus,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  createRegistrationTeam,
  joinRegistrationTeam,
  getTeamByInviteCode,
} from '@/app/actions/team-registration.actions'

interface TeamRegistrationModalProps {
  isOpen: boolean
  onClose: () => void
  eventId: string
  eventSlug: string
  eventTitle: string
  minTeamSize?: number
  maxTeamSize?: number
  initialMode?: 'create' | 'join'
  initialInviteCode?: string
}

export function TeamRegistrationModal({
  isOpen,
  onClose,
  eventId,
  eventSlug,
  eventTitle,
  minTeamSize = 2,
  maxTeamSize = 4,
  initialMode = 'create',
  initialInviteCode = '',
}: TeamRegistrationModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(initialMode)
  const [teamName, setTeamName] = useState('')
  const [inviteCode, setInviteCode] = useState(initialInviteCode)
  const [previewTeam, setPreviewTeam] = useState<{
    name: string
    memberCount: number
    maxTeamSize: number
    leaderName?: string
  } | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [isCheckingCode, setIsCheckingCode] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Look up invite code when typing in join mode
  useEffect(() => {
    const trimmed = inviteCode.trim().toUpperCase()
    if (activeTab !== 'join' || trimmed.length < 6) {
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      setIsCheckingCode(true)
      try {
        const res = await getTeamByInviteCode(trimmed)
        if (!isMounted) return
        if (res.success && res.team) {
          setPreviewTeam({
            name: res.team.name,
            memberCount: res.team.memberCount,
            maxTeamSize: res.team.maxTeamSize,
            leaderName: res.team.leaderName,
          })
          setPreviewError(null)
        } else {
          setPreviewTeam(null)
          setPreviewError(res.error || 'Team not found')
        }
      } catch {
        if (isMounted) {
          setPreviewTeam(null)
          setPreviewError('Could not verify invite code')
        }
      } finally {
        if (isMounted) {
          setIsCheckingCode(false)
        }
      }
    }, 300)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [inviteCode, activeTab])

  if (!isOpen) return null

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!teamName.trim()) {
      toast.error('Please enter a team name')
      return
    }

    startTransition(async () => {
      const res = await createRegistrationTeam(eventId, teamName, eventSlug)
      if (res.success) {
        toast.success(`Team "${res.teamName}" created!`, {
          description: `Share invite code ${res.inviteCode} with teammates.`,
        })
        onClose()
      } else {
        toast.error('Failed to create team', { description: res.error })
      }
    })
  }

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inviteCode.trim().toUpperCase()
    if (!trimmed) {
      toast.error('Please enter a team invite code')
      return
    }

    startTransition(async () => {
      const res = await joinRegistrationTeam(trimmed, eventSlug)
      if (res.success) {
        toast.success(`Joined team "${res.teamName}"!`, {
          description: `Team currently has ${res.memberCount} members.`,
        })
        onClose()
      } else {
        toast.error('Failed to join team', { description: res.error })
      }
    })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-2xl">
        {/* Header */}
        <div className="relative shrink-0 border-b border-[--border-subtle] px-6 py-5">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-1.5 text-[--text-muted] hover:bg-[--bg-muted] hover:text-[--text-primary]"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-lg font-bold text-[--text-primary]">Team Registration</h2>
          </div>
          <p className="mt-0.5 text-xs text-[--text-muted] line-clamp-1">{eventTitle}</p>

          {/* Mode Switcher Tabs */}
          <div className="mt-4 flex rounded-lg bg-[--bg-muted] p-1">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'create'
                  ? 'bg-[--bg-surface] text-[--text-primary] shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text-primary]'
              }`}
            >
              Create a New Team
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('join')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                activeTab === 'join'
                  ? 'bg-[--bg-surface] text-[--text-primary] shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text-primary]'
              }`}
            >
              Join with Invite Code
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'create' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-indigo-900 dark:border-indigo-900/40 dark:bg-indigo-950/30 dark:text-indigo-200">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">Team Size Rules for this Event</p>
                    <p className="mt-0.5 text-indigo-700 dark:text-indigo-300">
                      Teams require a minimum of <strong>{minTeamSize}</strong> members and up to <strong>{maxTeamSize}</strong> members. As leader, you’ll receive an invite code to share with teammates.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="team-name" className="text-sm font-medium text-[--text-primary]">
                  Team Name <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="e.g. ByteRunners, CodeCrafters"
                  maxLength={60}
                  required
                  className="text-sm"
                  autoFocus
                />
                <p className="text-[11px] text-[--text-muted]">
                  Choose a unique name for your team (2-60 characters).
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} size="sm">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !teamName.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  size="sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Create Team & Get Code
                    </>
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-code" className="text-sm font-medium text-[--text-primary]">
                  Team Invite Code <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="invite-code"
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4E5"
                  maxLength={20}
                  required
                  className="font-mono text-base uppercase tracking-wider"
                  autoFocus
                />
                <p className="text-[11px] text-[--text-muted]">
                  Enter the 10-character alphanumeric code provided by your team leader.
                </p>
              </div>

              {/* Preview Box */}
              {isCheckingCode && (
                <div className="flex items-center gap-2 text-xs text-[--text-muted]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying team invite code...
                </div>
              )}

              {previewTeam && !isCheckingCode && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-semibold text-sm">{previewTeam.name}</span>
                  </div>
                  <div className="mt-2 space-y-1 text-emerald-800 dark:text-emerald-300">
                    <p>Leader: <span className="font-medium">{previewTeam.leaderName}</span></p>
                    <p>
                      Current Members:{' '}
                      <span className="font-medium">
                        {previewTeam.memberCount} of {previewTeam.maxTeamSize} max spots filled
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {previewError && !isCheckingCode && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{previewError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose} size="sm">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || !inviteCode.trim() || !!previewError}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  size="sm"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Users className="h-4 w-4" />
                      Join Team
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
