'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import {
  Users,
  QrCode,
  Shield,
  Check,
  X,
  UserCheck,
  ExternalLink,
  Linkedin,
  Globe,
  Github,
  Sparkles,
  ArrowLeft,
  Loader2,
  Ban,
  Edit3,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import QRCode from 'qrcode'
import {
  setEventNetworkingOptIn,
  upsertUserNetworkingCard,
  requestContactExchange,
  respondToContactExchange,
  blockNetworkingUser,
} from '@/app/actions/networking.actions'
import type { UserNetworkingCard } from '@/types'
import { ReportButton } from '@/components/moderation/ReportButton'

interface NetworkingHubClientProps {
  eventId: string
  eventSlug: string
  eventTitle: string
  initialData: {
    isOptedIn: boolean
    exchangeToken: string
    myCard: UserNetworkingCard | null
    incomingRequests: Array<{
      id: string
      requesterId: string
      name: string
      headline?: string | null
      course?: string | null
      createdAt: string
    }>
    outgoingRequests: Array<{
      id: string
      recipientId: string
      status: string
      createdAt: string
    }>
    connectedCards: UserNetworkingCard[]
    directory: Array<{
      userId: string
      fullName: string
      headline?: string | null
      course?: string | null
      exchangeToken: string
      hasPendingRequest: boolean
      isConnected: boolean
    }>
  }
}

export function NetworkingHubClient({
  eventId,
  eventSlug,
  eventTitle,
  initialData,
}: NetworkingHubClientProps) {
  const [isPending, startTransition] = useTransition()
  const [isOptedIn, setIsOptedIn] = useState(initialData.isOptedIn)
  const [exchangeToken, setExchangeToken] = useState(initialData.exchangeToken)
  const [myCard, setMyCard] = useState<UserNetworkingCard | null>(initialData.myCard)
  const [incomingRequests, setIncomingRequests] = useState(initialData.incomingRequests)
  const [connectedCards, setConnectedCards] = useState(initialData.connectedCards)
  const [directory, setDirectory] = useState(initialData.directory)

  const [activeTab, setActiveTab] = useState<'connections' | 'directory' | 'requests' | 'mycard'>(
    initialData.incomingRequests.length > 0 ? 'requests' : 'directory'
  )
  const [showQrModal, setShowQrModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [manualTokenInput, setManualTokenInput] = useState('')

  // Edit card form states
  const [editName, setEditName] = useState(myCard?.full_name || '')
  const [editCourse, setEditCourse] = useState(myCard?.course_or_major || '')
  const [editHeadline, setEditHeadline] = useState(myCard?.headline || '')
  const [editInterests, setEditInterests] = useState((myCard?.interests || []).join(', '))
  const [editLinkedin, setEditLinkedin] = useState(myCard?.linkedin_url || '')
  const [editPortfolio, setEditPortfolio] = useState(myCard?.portfolio_url || '')
  const [editGithub, setEditGithub] = useState(myCard?.github_url || '')

  // Generate QR Code data URL
  useEffect(() => {
    if (exchangeToken) {
      const exchangeUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/events/${eventSlug}/networking?token=${exchangeToken}`
        : `token:${exchangeToken}`

      QRCode.toDataURL(exchangeUrl, {
        width: 320,
        margin: 2,
        color: { dark: '#09090b', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch((err) => console.error('Failed to render networking QR:', err))
    }
  }, [exchangeToken, eventSlug])

  const handleToggleOptIn = (optIn: boolean) => {
    startTransition(async () => {
      const res = await setEventNetworkingOptIn(eventId, optIn)
      if (res.success) {
        setIsOptedIn(optIn)
        if (res.exchangeToken) setExchangeToken(res.exchangeToken)
        toast.success(optIn ? 'Networking mode enabled for this event!' : 'Networking mode disabled.')
      } else {
        toast.error(res.error || 'Failed to update networking mode.')
      }
    })
  }

  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editName.trim()) {
      toast.error('Name is required.')
      return
    }

    const interestsArray = editInterests
      .split(',')
      .map((i) => i.trim())
      .filter((i) => i.length > 0)

    startTransition(async () => {
      const res = await upsertUserNetworkingCard({
        full_name: editName.trim(),
        course_or_major: editCourse.trim() || null,
        headline: editHeadline.trim() || null,
        interests: interestsArray,
        linkedin_url: editLinkedin.trim() || null,
        portfolio_url: editPortfolio.trim() || null,
        github_url: editGithub.trim() || null,
      })

      if (res.success && res.data) {
        setMyCard(res.data)
        setShowEditModal(false)
        toast.success('Networking card updated!')
      } else {
        toast.error(res.error || 'Failed to save card.')
      }
    })
  }

  const handleConnectByToken = (targetToken: string) => {
    if (!targetToken.trim()) return

    startTransition(async () => {
      const res = await requestContactExchange(eventId, targetToken.trim())
      if (res.success) {
        toast.success(res.message || 'Contact exchange request sent!')
        setManualTokenInput('')
      } else {
        toast.error(res.error || 'Could not send contact request.')
      }
    })
  }

  const handleRespondRequest = (requestId: string, action: 'accept' | 'decline' | 'block') => {
    startTransition(async () => {
      const res = await respondToContactExchange(requestId, action)
      if (res.success) {
        setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId))
        if (action === 'accept') {
          toast.success('Contact cards exchanged! You are now connected.')
          // Refresh page or trigger connection reload
          window.location.reload()
        } else if (action === 'block') {
          toast.success('User blocked from networking.')
        } else {
          toast.info('Request declined.')
        }
      } else {
        toast.error(res.error || 'Failed to respond.')
      }
    })
  }

  const handleBlockUser = (userId: string) => {
    if (!confirm('Are you sure you want to block this user from networking?')) return

    startTransition(async () => {
      const res = await blockNetworkingUser(userId)
      if (res.success) {
        setConnectedCards((prev) => prev.filter((c) => c.user_id !== userId))
        setDirectory((prev) => prev.filter((d) => d.userId !== userId))
        toast.success('User blocked.')
      } else {
        toast.error(res.error || 'Failed to block user.')
      }
    })
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/events/${eventSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[--text-muted] hover:text-[--text-primary] mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Event Overview
          </Link>
          <h1 className="text-2xl font-bold text-[--text-primary] tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            <span>Event Networking Hub</span>
          </h1>
          <p className="text-xs text-[--text-secondary] mt-0.5">
            Connect with peers at <span className="font-semibold text-[--text-primary]">{eventTitle}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOptedIn && (
            <Button
              onClick={() => setShowQrModal(true)}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs rounded-xl"
            >
              <QrCode className="h-4 w-4 text-blue-600" />
              <span>My QR Contact Pass</span>
            </Button>
          )}
        </div>
      </div>

      {/* Opt-In Control & Privacy Guarantee Banner */}
      <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600">
                <Shield className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-[--text-primary]">
                Event-Specific Networking Mode
              </h3>
            </div>
            <p className="text-xs text-[--text-muted] leading-relaxed max-w-2xl">
              Networking on CampusLoop is strictly opt-in and event-specific. When enabled, attendees can request to connect.
              <strong className="text-[--text-primary]"> Your social links and portfolio are only shared after you explicitly confirm each request.</strong>
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-[--text-secondary]">
              {isOptedIn ? 'Mode Active' : 'Mode Disabled'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={isOptedIn}
              disabled={isPending}
              onClick={() => handleToggleOptIn(!isOptedIn)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                isOptedIn ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  isOptedIn ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Quick Connect Token Bar */}
        {isOptedIn && (
          <div className="pt-3 border-t border-[--border-subtle] flex flex-col sm:flex-row items-center gap-2">
            <span className="text-xs font-medium text-[--text-secondary] whitespace-nowrap">
              Exchange with code / scan:
            </span>
            <div className="flex w-full sm:w-auto flex-1 items-center gap-2">
              <Input
                value={manualTokenInput}
                onChange={(e) => setManualTokenInput(e.target.value)}
                placeholder="Paste attendee's 32-character token or scan code..."
                className="text-xs h-8 font-mono"
              />
              <Button
                onClick={() => handleConnectByToken(manualTokenInput)}
                disabled={isPending || !manualTokenInput.trim()}
                size="sm"
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg whitespace-nowrap"
              >
                Send Request
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-[--border-subtle] pb-2 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'directory'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
          }`}
        >
          <Users className="h-3.5 w-3.5 text-blue-500" />
          <span>Attendees ({directory.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('connections')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'connections'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
          }`}
        >
          <UserCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Connected Contacts ({connectedCards.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`relative inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'requests'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
          }`}
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Requests</span>
          {incomingRequests.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.2 font-bold animate-pulse">
              {incomingRequests.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('mycard')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            activeTab === 'mycard'
              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
              : 'text-[--text-secondary] hover:bg-[--bg-muted] hover:text-[--text-primary]'
          }`}
        >
          <Edit3 className="h-3.5 w-3.5 text-purple-500" />
          <span>My Networking Card</span>
        </button>
      </div>

      {/* Tab 1: Attendees Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          {!isOptedIn ? (
            <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-8 text-center space-y-3">
              <Users className="h-10 w-10 text-[--text-muted] mx-auto opacity-50" />
              <h3 className="font-semibold text-sm text-[--text-primary]">
                Networking Mode is Disabled
              </h3>
              <p className="text-xs text-[--text-secondary] max-w-sm mx-auto">
                Turn on Networking Mode above to discover fellow attendees and exchange contacts.
              </p>
              <Button
                onClick={() => handleToggleOptIn(true)}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
              >
                Enable Networking
              </Button>
            </div>
          ) : directory.length === 0 ? (
            <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-8 text-center space-y-2">
              <Users className="h-8 w-8 text-[--text-muted] mx-auto opacity-50" />
              <p className="text-sm font-medium text-[--text-primary]">No other attendees in networking mode yet</p>
              <p className="text-xs text-[--text-secondary]">
                Share your QR contact pass with peers during the event to connect instantly!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {directory.map((att) => (
                <div
                  key={att.userId}
                  className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4 flex flex-col justify-between space-y-3 shadow-sm hover:border-blue-500/40 transition-colors"
                >
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm text-[--text-primary]">{att.fullName}</h4>
                    {att.headline && (
                      <p className="text-xs text-[--text-secondary] line-clamp-2">{att.headline}</p>
                    )}
                    {att.course && (
                      <span className="inline-block rounded-md bg-[--bg-muted] px-2 py-0.5 text-[10px] font-medium text-[--text-secondary]">
                        {att.course}
                      </span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[--border-subtle] flex items-center justify-between gap-2">
                    {att.isConnected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    ) : att.hasPendingRequest ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600">
                        <Loader2 className="h-3 w-3 animate-spin" /> Pending Approval
                      </span>
                    ) : (
                      <Button
                        onClick={() => handleConnectByToken(att.exchangeToken)}
                        disabled={isPending}
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 w-full rounded-lg"
                      >
                        Request Contact
                      </Button>
                    )}

                    <ReportButton targetType="networking_profile" targetId={att.userId} targetTitle={att.fullName} variant="ghost" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Connected Contacts */}
      {activeTab === 'connections' && (
        <div className="space-y-4">
          {connectedCards.length === 0 ? (
            <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-8 text-center space-y-2">
              <UserCheck className="h-8 w-8 text-[--text-muted] mx-auto opacity-50" />
              <p className="text-sm font-medium text-[--text-primary]">No confirmed contacts yet</p>
              <p className="text-xs text-[--text-secondary]">
                When an attendee accepts your contact exchange request, their full networking card appears here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {connectedCards.map((card) => (
                <div
                  key={card.user_id}
                  className="rounded-2xl border border-emerald-500/20 bg-[--bg-surface] p-5 space-y-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-bold text-sm text-[--text-primary]">{card.full_name}</h4>
                      {card.headline && (
                        <p className="text-xs text-[--text-secondary] mt-0.5">{card.headline}</p>
                      )}
                      {card.course_or_major && (
                        <span className="mt-1.5 inline-block rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 px-2 py-0.5 text-[11px] font-medium">
                          {card.course_or_major}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleBlockUser(card.user_id)}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-zinc-400 hover:text-red-500"
                        title="Block Contact"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                      <ReportButton targetType="networking_profile" targetId={card.user_id} targetTitle={card.full_name} variant="ghost" />
                    </div>
                  </div>

                  {card.interests && card.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {card.interests.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md bg-[--bg-muted] px-2 py-0.5 text-[10px] text-[--text-secondary]"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Social & Portfolio Links */}
                  <div className="pt-2 border-t border-[--border-subtle] flex flex-wrap items-center gap-2">
                    {card.linkedin_url && (
                      <a
                        href={card.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 px-2.5 py-1 text-xs font-semibold hover:underline"
                      >
                        <Linkedin className="h-3 w-3" />
                        <span>LinkedIn</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {card.portfolio_url && (
                      <a
                        href={card.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 px-2.5 py-1 text-xs font-semibold hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        <span>Portfolio</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                    {card.github_url && (
                      <a
                        href={card.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-2.5 py-1 text-xs font-semibold hover:underline"
                      >
                        <Github className="h-3 w-3" />
                        <span>GitHub</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Incoming & Outgoing Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[--text-muted]">
              Incoming Contact Requests ({incomingRequests.length})
            </h3>
            {incomingRequests.length === 0 ? (
              <p className="text-xs text-[--text-muted] italic">No pending requests from other attendees.</p>
            ) : (
              <div className="space-y-3">
                {incomingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <h4 className="font-semibold text-sm text-[--text-primary]">{req.name}</h4>
                      {req.headline && <p className="text-xs text-[--text-secondary]">{req.headline}</p>}
                      {req.course && (
                        <span className="text-[11px] text-[--text-muted] font-medium">Major: {req.course}</span>
                      )}
                      <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
                        Accepting will exchange your networking card with {req.name}.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => handleRespondRequest(req.id, 'accept')}
                        disabled={isPending}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Accept & Share
                      </Button>
                      <Button
                        onClick={() => handleRespondRequest(req.id, 'decline')}
                        disabled={isPending}
                        variant="outline"
                        size="sm"
                        className="text-xs rounded-lg"
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Decline
                      </Button>
                      <Button
                        onClick={() => handleRespondRequest(req.id, 'block')}
                        disabled={isPending}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-500 hover:text-red-700"
                        title="Block User"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: My Networking Card Preview */}
      {activeTab === 'mycard' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[--text-muted]">
              Your Card Preview
            </h3>
            <Button
              onClick={() => setShowEditModal(true)}
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-xl"
            >
              <Edit3 className="h-3.5 w-3.5 text-blue-600" />
              <span>Edit Card Details</span>
            </Button>
          </div>

          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-6 max-w-lg space-y-4 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-[--text-primary]">
                {myCard?.full_name || 'Your Full Name'}
              </h3>
              <p className="text-xs text-[--text-secondary] mt-0.5">
                {myCard?.headline || 'No headline set yet'}
              </p>
              {myCard?.course_or_major && (
                <span className="mt-2 inline-block rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-xs font-medium">
                  {myCard.course_or_major}
                </span>
              )}
            </div>

            {myCard?.interests && myCard.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {myCard.interests.map((t) => (
                  <span key={t} className="rounded-md bg-[--bg-muted] px-2 py-0.5 text-xs text-[--text-secondary]">
                    #{t}
                  </span>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-[--border-subtle] flex flex-wrap gap-2 text-xs">
              {myCard?.linkedin_url ? (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn Linked
                </span>
              ) : (
                <span className="text-zinc-400">No LinkedIn</span>
              )}
              {myCard?.portfolio_url && (
                <span className="inline-flex items-center gap-1 text-emerald-600">
                  <Globe className="h-3.5 w-3.5" /> Portfolio Linked
                </span>
              )}
              {myCard?.github_url && (
                <span className="inline-flex items-center gap-1 text-zinc-700 dark:text-zinc-300">
                  <Github className="h-3.5 w-3.5" /> GitHub Linked
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR Code Contact Pass Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Your Contact Pass</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Have another attendee scan this code to send you a contact exchange request.
            </p>

            <div className="flex justify-center p-3 bg-white rounded-2xl border border-zinc-200 shadow-inner">
              {qrDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={qrDataUrl} alt="Networking QR Code" className="h-56 w-56 object-contain" />
              ) : (
                <div className="h-56 w-56 bg-zinc-100 animate-pulse rounded-xl" />
              )}
            </div>

            <div className="text-[11px] font-mono text-zinc-400 truncate">
              Token: {exchangeToken}
            </div>

            <Button
              onClick={() => {
                navigator.clipboard.writeText(exchangeToken)
                toast.success('Token copied to clipboard!')
              }}
              variant="outline"
              size="sm"
              className="w-full text-xs rounded-xl"
            >
              Copy Exchange Code
            </Button>
          </div>
        </div>
      )}

      {/* Edit Networking Card Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 p-6 space-y-4 shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-100">Edit Networking Card</h3>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="rounded-full p-1 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Only approved academic & professional fields can be stored. Private phone numbers and student IDs are strictly prohibited.
            </p>

            <form onSubmit={handleSaveCard} className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Full Name *</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Course / Major</Label>
                <Input
                  value={editCourse}
                  onChange={(e) => setEditCourse(e.target.value)}
                  placeholder="e.g. Computer Science, 3rd Year"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Professional Headline</Label>
                <Input
                  value={editHeadline}
                  onChange={(e) => setEditHeadline(e.target.value)}
                  placeholder="e.g. Aspiring ML Engineer & Hackathon Builder"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Interests (comma separated)</Label>
                <Input
                  value={editInterests}
                  onChange={(e) => setEditInterests(e.target.value)}
                  placeholder="e.g. AI, Robotics, Design Systems"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">LinkedIn Profile URL</Label>
                <Input
                  value={editLinkedin}
                  onChange={(e) => setEditLinkedin(e.target.value)}
                  placeholder="https://linkedin.com/in/username"
                  type="url"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Portfolio / Website URL</Label>
                <Input
                  value={editPortfolio}
                  onChange={(e) => setEditPortfolio(e.target.value)}
                  placeholder="https://alexrivera.dev"
                  type="url"
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">GitHub URL</Label>
                <Input
                  value={editGithub}
                  onChange={(e) => setEditGithub(e.target.value)}
                  placeholder="https://github.com/username"
                  type="url"
                  className="text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditModal(false)}
                  className="text-xs rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl"
                >
                  Save Card
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
