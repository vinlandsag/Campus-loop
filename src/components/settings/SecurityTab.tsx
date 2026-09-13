'use client'

import { useState, useTransition } from 'react'
import {
  Shield,
  KeyRound,
  Mail,
  Smartphone,
  LogOut,
  CheckCircle2,
  Clock,
  History,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  changeAccountPassword,
  revokeAllOtherSessions,
  toggleTwoFactor,
} from '@/app/actions/settings.actions'
import type { SecurityAuditLog } from '@/types'

interface SecurityTabProps {
  userEmail: string
  isEmailConfirmed: boolean
  twoFactorEnabled: boolean
  auditLogs: SecurityAuditLog[]
}

export function SecurityTab({
  userEmail,
  isEmailConfirmed,
  twoFactorEnabled,
  auditLogs: initialLogs,
}: SecurityTabProps) {
  // Password state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // 2FA state
  const [twoFactor, setTwoFactor] = useState(twoFactorEnabled)
  const [isToggling2FA, start2FATransition] = useTransition()

  // Session state
  const [isRevokingSessions, setIsRevokingSessions] = useState(false)
  const [logs] = useState<SecurityAuditLog[]>(initialLogs)

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long.')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    setIsUpdatingPassword(true)
    try {
      const res = await changeAccountPassword(newPassword)
      if (res.success) {
        toast.success('Password updated successfully!')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        toast.error(res.error || 'Failed to update password.')
      }
    } catch {
      toast.error('Could not update password.')
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleRevokeSessions = async () => {
    setIsRevokingSessions(true)
    try {
      const res = await revokeAllOtherSessions()
      if (res.success) {
        toast.success('Signed out of all other devices successfully.')
      } else {
        toast.error(res.error || 'Failed to sign out of other devices.')
      }
    } catch {
      toast.error('Could not revoke sessions.')
    } finally {
      setIsRevokingSessions(false)
    }
  }

  const handleToggle2FA = (checked: boolean) => {
    start2FATransition(async () => {
      const res = await toggleTwoFactor(checked)
      if (res.success) {
        setTwoFactor(checked)
        toast.success(checked ? 'Two-factor protection enabled.' : 'Two-factor protection disabled.')
      } else {
        toast.error(res.error || 'Failed to update 2FA status.')
      }
    })
  }

  const formatActionName = (action: string) => {
    switch (action) {
      case 'password_changed':
        return 'Password Changed'
      case 'session_revoked':
        return 'Other Sessions Revoked'
      case 'privacy_updated':
        return 'Privacy Preferences Updated'
      case 'campus_change_requested':
        return 'Campus Transfer Requested'
      case 'organizer_profile_updated':
        return 'Profile / Public Info Updated'
      case 'organizer_workspace_updated':
        return 'Organizer Workspace Updated'
      case 'account_deletion_requested':
        return 'Account Deletion Scheduled'
      case 'account_deletion_cancelled':
        return 'Account Deletion Cancelled'
      case 'two_factor_toggled':
        return 'Two-Factor Toggled'
      case 'user_unblocked':
        return 'User Unblocked'
      default:
        return action.replace(/_/g, ' ')
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-display text-xl font-bold text-[--text-primary]">
          Security &amp; Device Access
        </h2>
        <p className="mt-1 text-xs text-[--text-secondary]">
          Manage your credentials, active sessions, and review recent account security actions.
        </p>
      </div>

      {/* Email Verification Status */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[--text-primary]">Institutional Email Verification</p>
              <p className="text-xs text-[--text-muted]">{userEmail}</p>
            </div>
          </div>

          <div>
            {isEmailConfirmed ? (
              <Badge variant="default" className="bg-emerald-600 text-white gap-1 py-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Email Verified
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 gap-1 py-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Verification Pending
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Change Password Form */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[--border-subtle] pb-3">
          <KeyRound className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-[--text-primary]">Change Account Password</h3>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
          <div className="space-y-1.5">
            <Label htmlFor="new_password" className="text-xs">
              New Password (minimum 8 characters)
            </Label>
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password" className="text-xs">
              Confirm New Password
            </Label>
            <Input
              id="confirm_password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              className="text-xs"
            />
          </div>

          <Button type="submit" size="sm" disabled={isUpdatingPassword} className="gap-2">
            {isUpdatingPassword && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Update Password
          </Button>
        </form>
      </div>

      {/* Two-Factor Authentication Toggle */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 flex items-start justify-between gap-4 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-[--text-primary]">
              Two-Factor Authentication (2FA)
            </h3>
          </div>
          <p className="text-xs text-[--text-secondary] max-w-lg leading-relaxed">
            Require an additional verification challenge when signing in from unfamiliar campus devices.
          </p>
          {twoFactor && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
              <Shield className="h-3 w-3" /> Account protected with 2FA
            </span>
          )}
        </div>

        <input
          type="checkbox"
          checked={twoFactor}
          disabled={isToggling2FA}
          onChange={(e) => handleToggle2FA(e.target.checked)}
          className="h-5 w-5 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 mt-1 cursor-pointer"
        />
      </div>

      {/* Active Sessions / Sign Out All */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[--text-primary] flex items-center gap-2">
              <LogOut className="h-4 w-4 text-amber-600" />
              Device Sessions
            </h3>
            <p className="text-xs text-[--text-secondary] mt-0.5">
              Lost a campus computer session or logged in on a public library machine? Sign out everywhere else.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRevokeSessions}
            disabled={isRevokingSessions}
            className="text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1.5 self-start"
          >
            {isRevokingSessions ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
            Sign Out All Other Devices
          </Button>
        </div>
      </div>

      {/* Recent Security Activity Audit Log */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-[--border-subtle] bg-[--bg-muted]/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-zinc-500" />
            <h3 className="text-sm font-semibold text-[--text-primary]">Recent Security Activity</h3>
          </div>
          <span className="text-[11px] text-[--text-muted]">Last 20 events</span>
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[--text-muted]">
            No recent security activity logged for this account.
          </div>
        ) : (
          <div className="divide-y divide-[--border-subtle]">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 sm:p-4 flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-[--text-primary] capitalize truncate">
                    {formatActionName(log.action)}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-[--text-muted]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    {log.ip_address && <span>• IP: {log.ip_address}</span>}
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                  Logged
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
