'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Webhook,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  ArrowLeft,
  X,
  Shield,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  saveEventIntegration,
  deleteEventIntegration,
  testWebhookIntegration,
} from '@/app/actions/integration.actions'
import type { EventWebhookIntegration } from '@/types'

interface IntegrationsClientProps {
  eventId: string
  eventTitle: string
  initialIntegrations: EventWebhookIntegration[]
}

export function IntegrationsClient({
  eventId,
  eventTitle,
  initialIntegrations,
}: IntegrationsClientProps) {
  const [integrations, setIntegrations] = useState(initialIntegrations)
  const [isPending, startTransition] = useTransition()
  const [showAddModal, setShowAddModal] = useState(false)

  // Form states
  const [platform, setPlatform] = useState<'discord' | 'slack' | 'generic'>('discord')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [notifyOnAnnouncement, setNotifyOnAnnouncement] = useState(true)
  const [notifyOnReschedule, setNotifyOnReschedule] = useState(true)

  const handleOpenAdd = () => {
    setWebhookUrl('')
    setNotifyOnAnnouncement(true)
    setNotifyOnReschedule(true)
    setShowAddModal(true)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!webhookUrl.trim()) {
      toast.error('Webhook URL is required.')
      return
    }

    startTransition(async () => {
      const res = await saveEventIntegration(eventId, {
        platform,
        webhook_url: webhookUrl.trim(),
        notify_on_announcement: notifyOnAnnouncement,
        notify_on_reschedule: notifyOnReschedule,
      })

      if (res.success && res.data) {
        setIntegrations((prev) => [...prev, res.data!])
        setShowAddModal(false)
        toast.success(`${platform.toUpperCase()} webhook added!`)
      } else {
        toast.error(res.error || 'Failed to add webhook.')
      }
    })
  }

  const handleDelete = (id: string, plat: string) => {
    if (!confirm(`Remove this ${plat} webhook?`)) return

    startTransition(async () => {
      const res = await deleteEventIntegration(eventId, id)
      if (res.success) {
        setIntegrations((prev) => prev.filter((item) => item.id !== id))
        toast.success('Webhook removed.')
      } else {
        toast.error(res.error || 'Failed to remove webhook.')
      }
    })
  }

  const handleTest = (id: string) => {
    startTransition(async () => {
      toast.info('Sending test ping...')
      const res = await testWebhookIntegration(id)
      if (res.success) {
        toast.success('Test ping delivered successfully!')
      } else {
        toast.error(res.error || 'Failed to reach webhook URL.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/dashboard/events`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[--text-muted] hover:text-[--text-primary] mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Dashboard Events
          </Link>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight flex items-center gap-2">
            <Webhook className="h-6 w-6 text-indigo-600" />
            <span>Discord & Slack Integrations</span>
          </h1>
          <p className="text-xs text-[--text-secondary] mt-0.5">
            Broadcast live announcements to club communication channels for <span className="font-semibold text-[--text-primary]">{eventTitle}</span>
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          size="sm"
          className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl"
        >
          <Plus className="h-4 w-4" />
          <span>Connect Webhook</span>
        </Button>
      </div>

      {/* Security Notice */}
      <div className="rounded-2xl border border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-4 text-xs space-y-1">
        <div className="flex items-center gap-2 font-semibold text-indigo-900 dark:text-indigo-200">
          <Shield className="h-4 w-4 text-indigo-600" />
          <span>Privacy & Security Guarantee</span>
        </div>
        <p className="text-indigo-800/90 dark:text-indigo-300/90 leading-relaxed">
          Outbound integrations strictly broadcast public announcements and schedule changes.
          <strong> Private attendee rosters, student emails, tickets, and internal question responses are never sent to external webhooks.</strong>
        </p>
      </div>

      {/* Integrations Roster */}
      {integrations.length === 0 ? (
        <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-10 text-center space-y-3">
          <MessageSquare className="h-10 w-10 text-[--text-muted] mx-auto opacity-50" />
          <h3 className="font-semibold text-sm text-[--text-primary]">No Active Webhooks</h3>
          <p className="text-xs text-[--text-secondary] max-w-md mx-auto">
            Connect a Discord channel or Slack workspace to automatically notify club members when organizers post live announcements.
          </p>
          <Button
            onClick={handleOpenAdd}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl"
          >
            Connect First Webhook
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {integrations.map((wh) => (
            <div
              key={wh.id}
              className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl font-bold text-xs ${
                    wh.platform === 'discord'
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                  }`}>
                    {wh.platform === 'discord' ? 'DC' : 'SL'}
                  </span>
                  <div>
                    <h4 className="font-bold text-sm text-[--text-primary] capitalize">
                      {wh.platform} Channel Webhook
                    </h4>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Active & Connected
                    </span>
                  </div>
                </div>

                <Button
                  onClick={() => handleDelete(wh.id, wh.platform)}
                  disabled={isPending}
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="rounded-lg bg-[--bg-muted] p-2 font-mono text-[10px] text-[--text-muted] truncate">
                {wh.webhook_url.slice(0, 45)}••••••••
              </div>

              <div className="pt-2 border-t border-[--border-subtle] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] text-[--text-secondary]">
                  {wh.notify_on_announcement && <span>• Announcements</span>}
                  {wh.notify_on_reschedule && <span>• Reschedules</span>}
                </div>

                <Button
                  onClick={() => handleTest(wh.id)}
                  disabled={isPending}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1 rounded-lg"
                >
                  <Send className="h-3 w-3" />
                  <span>Send Test Ping</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Webhook Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">
                Connect New Webhook
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Destination Platform</Label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as 'discord' | 'slack' | 'generic')}
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-2 text-xs text-zinc-900 dark:text-zinc-100"
                >
                  <option value="discord">Discord Channel</option>
                  <option value="slack">Slack Workspace Channel</option>
                  <option value="generic">Generic Webhook endpoint</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Webhook URL *</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder={
                    platform === 'discord'
                      ? 'https://discord.com/api/webhooks/...'
                      : 'https://hooks.slack.com/services/...'
                  }
                  required
                  type="url"
                  className="text-xs font-mono"
                />
                <p className="text-[11px] text-[--text-muted]">
                  {platform === 'discord'
                    ? 'In Discord: Channel Settings -> Integrations -> Webhooks -> Copy Webhook URL'
                    : 'In Slack: Channel Settings -> Integrations -> Incoming WebHooks'}
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-zinc-200 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notify_ann"
                    checked={notifyOnAnnouncement}
                    onChange={(e) => setNotifyOnAnnouncement(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  <Label htmlFor="notify_ann" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Broadcast new announcements & live board updates
                  </Label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notify_resched"
                    checked={notifyOnReschedule}
                    onChange={(e) => setNotifyOnReschedule(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-600 h-4 w-4"
                  />
                  <Label htmlFor="notify_resched" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    Broadcast schedule and venue changes
                  </Label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddModal(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl"
                >
                  Save Webhook
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
