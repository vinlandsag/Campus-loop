'use client'

import { useState, useRef, useEffect, useTransition, useSyncExternalStore } from 'react'
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ScanLine,
  UserCheck,
  RefreshCw,
  Search,
  Users,
  Percent,
  Wifi,
  WifiOff,
  CloudUpload,
  Database,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  checkInAttendee,
  getEventAttendanceStats,
  getOfflineCheckInRoster,
  syncOfflineCheckIns,
} from '@/app/actions/attendance.actions'
import {
  saveOfflineRoster,
  loadOfflineRoster,
  clearOfflineRoster,
  isRosterExpired,
} from '@/lib/offline/roster-storage'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type {
  CheckInResult,
  AttendanceStats,
  OfflineCheckInRoster,
  QueuedOfflineScan,
} from '@/types'

interface NativeBarcodeDetector {
  detect(source: HTMLVideoElement | ImageBitmapSource): Promise<Array<{ rawValue: string }>>
}

type NativeBarcodeDetectorConstructor = new (options?: { formats: string[] }) => NativeBarcodeDetector

declare global {
  interface Window {
    BarcodeDetector?: NativeBarcodeDetectorConstructor
  }
}

interface CheckInScannerClientProps {
  eventId: string
  eventTitle: string
  eventSlug: string
  initialStats: AttendanceStats
}

interface ScanLogItem {
  id: string
  ticketCode: string
  attendeeName?: string
  status: 'success' | 'already_checked_in' | 'error'
  message: string
  time: string
}

function subscribeToOnline(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getOnlineSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function getServerOnlineSnapshot() {
  return true
}

export function CheckInScannerClient({
  eventId,
  eventTitle: _eventTitle,
  initialStats,
}: CheckInScannerClientProps) {
  const [stats, setStats] = useState<AttendanceStats>(initialStats)
  const [manualCode, setManualCode] = useState('')
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null)
  const [scanLogs, setScanLogs] = useState<ScanLogItem[]>([])

  // Offline resilience state
  const isOnline = useSyncExternalStore(subscribeToOnline, getOnlineSnapshot, getServerOnlineSnapshot)
  const isOffline = !isOnline
  const [cachedRoster, setCachedRoster] = useState<OfflineCheckInRoster | null>(() => {
    const { roster, isExpired } = loadOfflineRoster(eventId)
    if (isExpired) {
      return null
    }
    return roster
  })
  const [offlineQueue, setOfflineQueue] = useState<QueuedOfflineScan[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const stored = localStorage.getItem(`campusloop_offline_queue_${eventId}`)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [isSyncing, setIsSyncing] = useState(false)

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const isScanningRef = useRef(false)

  // Refresh stats
  const refreshStats = async () => {
    try {
      const updated = await getEventAttendanceStats(eventId)
      setStats(updated)
    } catch (err) {
      console.error('Failed to refresh stats:', err)
    }
  }

  // Pre-cache attendee roster for offline check-in
  const handleCacheRoster = async () => {
    try {
      const res = await getOfflineCheckInRoster(eventId)
      if (res.success) {
        setCachedRoster(res.data)
        saveOfflineRoster(eventId, res.data)
        toast.success(`Cached ${res.data.attendees.length} attendee tickets for offline check-in!`)
      } else {
        toast.error(res.error || 'Failed to download offline roster.')
      }
    } catch (err) {
      console.error('Failed to cache roster:', err)
      toast.error('Could not download roster for offline check-in.')
    }
  }

  // Clear offline cached roster
  const handleClearRoster = () => {
    clearOfflineRoster(eventId)
    setCachedRoster(null)
    toast.info('Offline roster cache cleared.')
  }

  // Idempotently sync queued offline scans
  const handleSyncOfflineScans = async () => {
    if (offlineQueue.length === 0 || isSyncing) return
    setIsSyncing(true)

    try {
      const res = await syncOfflineCheckIns(eventId, offlineQueue)
      if (res.success) {
        const syncedCount = res.data.filter((s) => s.success && !s.alreadyCheckedIn).length
        const alreadyCount = res.data.filter((s) => s.alreadyCheckedIn).length
        toast.success(`Synchronized ${syncedCount} scans to server (${alreadyCount} already verified).`)
        setOfflineQueue([])
        localStorage.removeItem(`campusloop_offline_queue_${eventId}`)
        await refreshStats()
      } else {
        toast.error(res.error || 'Failed to sync offline scans.')
      }
    } catch (err) {
      console.error('Error syncing offline scans:', err)
      toast.error('Sync failed. Will retry when connection stabilizes.')
    } finally {
      setIsSyncing(false)
    }
  }

  // Automatically pre-cache roster on mount if online and not yet cached
  useEffect(() => {
    try {
      const storedRoster = localStorage.getItem(`campusloop_roster_${eventId}`)
      if (!storedRoster && navigator.onLine) {
        getOfflineCheckInRoster(eventId).then((res) => {
          if (res.success) {
            setCachedRoster(res.data)
            localStorage.setItem(`campusloop_roster_${eventId}`, JSON.stringify(res.data))
          }
        })
      }
    } catch (e) {
      console.warn('LocalStorage error:', e)
    }

    const handleOnline = () => {
      toast.info('Connection restored. Ready to sync offline scans.')
    }

    const handleOffline = () => {
      toast.warning('Network disconnected. Switched to offline check-in mode.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [eventId])

  // Handle a scanned or submitted ticket code
  const handleProcessTicket = (codeToProcess: string) => {
    const cleanCode = codeToProcess.trim().toUpperCase()
    if (!cleanCode) return

    const logTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

    // If offline or network unavailable, handle via cached roster
    if (isOffline || !navigator.onLine) {
      if (!cachedRoster || isRosterExpired(cachedRoster)) {
        clearOfflineRoster(eventId)
        setCachedRoster(null)
        toast.error('Offline roster has expired. Reconnect to download an updated roster.')
        return
      }

      const attendee = cachedRoster.attendees.find((a) => a.ticketCode.toUpperCase() === cleanCode)

      if (!attendee) {
        setScanLogs((prev) => [
          {
            id: `${Date.now()}`,
            ticketCode: cleanCode,
            status: 'error',
            message: 'Unrecognized ticket code in offline roster.',
            time: logTime,
          },
          ...prev.slice(0, 19),
        ])
        setLastResult({ success: false, error: 'Unrecognized ticket code in offline roster.' })
        return
      }

      // Check if already checked in locally or in queue
      const inQueue = offlineQueue.some((q) => q.ticketCode === cleanCode)
      const alreadyCheckedIn = Boolean(attendee.checkedInAt) || attendee.status === 'checked_in' || inQueue

      if (alreadyCheckedIn) {
        setScanLogs((prev) => [
          {
            id: `${Date.now()}`,
            ticketCode: cleanCode,
            attendeeName: attendee.attendeeName,
            status: 'already_checked_in',
            message: 'Already checked in (offline check)',
            time: logTime,
          },
          ...prev.slice(0, 19),
        ])
        setLastResult({
          success: true,
          alreadyCheckedIn: true,
          attendeeName: attendee.attendeeName,
          ticketCode: cleanCode,
        })
        return
      }

      // Record offline check-in
      const scanItem: QueuedOfflineScan = {
        scanId: `scan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ticketCode: cleanCode,
        scannedAt: new Date().toISOString(),
        attendeeName: attendee.attendeeName,
      }

      const updatedQueue = [...offlineQueue, scanItem]
      setOfflineQueue(updatedQueue)
      try {
        localStorage.setItem(`campusloop_offline_queue_${eventId}`, JSON.stringify(updatedQueue))
      } catch {}

      // Update local cached roster state
      attendee.checkedInAt = scanItem.scannedAt
      attendee.status = 'checked_in'

      // Update UI
      setScanLogs((prev) => [
        {
          id: `${Date.now()}`,
          ticketCode: cleanCode,
          attendeeName: attendee.attendeeName,
          status: 'success',
          message: 'Checked in offline (queued for sync)',
          time: logTime,
        },
        ...prev.slice(0, 19),
      ])

      setLastResult({
        success: true,
        alreadyCheckedIn: false,
        attendeeName: attendee.attendeeName,
        ticketCode: cleanCode,
      })

      setStats((prev) => ({
        ...prev,
        checkedInCount: prev.checkedInCount + 1,
        attendanceRate: prev.registeredCount > 0 ? Math.round(((prev.checkedInCount + 1) / prev.registeredCount) * 100) : 0,
      }))

      toast.success(`Checked in ${attendee.attendeeName} (Offline queued)`)
      return
    }

    // Online execution
    startTransition(async () => {
      const result = await checkInAttendee(eventId, cleanCode)
      setLastResult(result)

      if (result.success) {
        if (result.alreadyCheckedIn) {
          setScanLogs((prev) => [
            {
              id: `${Date.now()}`,
              ticketCode: cleanCode,
              attendeeName: result.attendeeName,
              status: 'already_checked_in',
              message: `Already checked in at ${new Date(result.checkedInAt || '').toLocaleTimeString()}`,
              time: logTime,
            },
            ...prev.slice(0, 19),
          ])
        } else {
          setScanLogs((prev) => [
            {
              id: `${Date.now()}`,
              ticketCode: cleanCode,
              attendeeName: result.attendeeName,
              status: 'success',
              message: 'Check-in confirmed',
              time: logTime,
            },
            ...prev.slice(0, 19),
          ])
          // Increment checked in locally and refresh
          setStats((prev) => {
            const newCheckedIn = prev.checkedInCount + 1
            return {
              ...prev,
              checkedInCount: newCheckedIn,
              attendanceRate: prev.registeredCount > 0 ? Math.round((newCheckedIn / prev.registeredCount) * 100) : 0,
            }
          })
          refreshStats()
        }
      } else {
        setScanLogs((prev) => [
          {
            id: `${Date.now()}`,
            ticketCode: cleanCode,
            status: 'error',
            message: result.error || 'Check-in failed',
            time: logTime,
          },
          ...prev.slice(0, 19),
        ])
      }

      setManualCode('')
    })
  }

  // Camera start / stop logic
  const startCamera = async () => {
    setCameraError(null)
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'environment' },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      isScanningRef.current = true
      startBarcodeLoop()
    } catch (err) {
      console.error('Camera access error:', err)
      setCameraError(
        'Unable to access device camera. Please grant camera permissions or use manual code entry.'
      )
      setCameraActive(false)
    }
  }

  const stopCamera = () => {
    isScanningRef.current = false
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setCameraActive(false)
  }

  // Native BarcodeDetector loop if supported
  const startBarcodeLoop = () => {
    const BarcodeDetectorClass = window.BarcodeDetector
    if (!BarcodeDetectorClass) {
      // BarcodeDetector not natively available in this browser
      return
    }

    try {
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] })
      const scanInterval = setInterval(async () => {
        if (!isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) {
          return
        }

        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const rawValue = barcodes[0]?.rawValue
            if (rawValue && rawValue.startsWith('CL-')) {
              // Pause scanning briefly to prevent rapid duplicate calls
              isScanningRef.current = false
              handleProcessTicket(rawValue)
              setTimeout(() => {
                isScanningRef.current = cameraActive
              }, 2500)
            }
          }
        } catch {
          // Ignore transient detection errors
        }
      }, 300)

      return () => clearInterval(scanInterval)
    } catch (e) {
      console.warn('BarcodeDetector initialization warning:', e)
    }
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Offline Status & Sync Banner */}
      <div className={`rounded-xl border p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isOffline
          ? 'border-amber-300 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20'
          : offlineQueue.length > 0
            ? 'border-blue-300 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/20'
            : 'border-[--border-subtle] bg-[--bg-surface]'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            isOffline
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
          }`}>
            {isOffline ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[--text-primary]">
                {isOffline ? 'Offline Check-In Active' : 'Connected to Server'}
              </span>
              <span className={`inline-block h-2 w-2 rounded-full ${
                isOffline ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`} />
            </div>
            <p className="text-[11px] text-[--text-secondary]">
              {isOffline
                ? `Campus network offline. Scans are validated against local cached roster (${cachedRoster?.attendees.length || 0} tickets) and queued safely.`
                : offlineQueue.length > 0
                  ? `${offlineQueue.length} offline scans queued and ready to sync.`
                  : cachedRoster
                    ? `Roster cached locally (${cachedRoster.attendees.length} tickets) for network outage protection.`
                    : 'Roster not yet cached. Click below to pre-cache for offline protection.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!cachedRoster ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCacheRoster}
              className="text-xs gap-1 h-8"
            >
              <Database className="h-3.5 w-3.5" />
              Pre-Cache Roster
            </Button>
          ) : (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCacheRoster}
                className="text-xs gap-1 h-8"
                title="Refresh offline attendee list"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Re-Cache
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleClearRoster}
                className="text-xs gap-1 h-8 text-[--text-muted] hover:text-red-600"
                title="Purge local offline attendee cache"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </Button>
            </div>
          )}

          {offlineQueue.length > 0 && (
            <Button
              size="sm"
              disabled={isSyncing || isOffline}
              onClick={handleSyncOfflineScans}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 h-8 font-medium"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {isSyncing ? 'Syncing...' : `Sync Scans (${offlineQueue.length})`}
            </Button>
          )}
        </div>
      </div>

      {/* Attendance Metrics Bar */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <Users className="h-4 w-4" />
            Registered
          </div>
          <p className="mt-2 text-2xl font-bold text-[--text-primary]">
            {stats.registeredCount}
            {stats.capacity ? (
              <span className="text-sm font-normal text-[--text-muted]"> / {stats.capacity}</span>
            ) : null}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            Checked In
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-900 dark:text-emerald-200">
            {stats.checkedInCount}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            Waitlist
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-900 dark:text-amber-200">
            {stats.waitlistCount}
          </p>
        </div>

        <div className="rounded-xl border border-[--border-subtle] bg-[--bg-surface] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[--text-muted]">
            <Percent className="h-4 w-4" />
            Turnout Rate
          </div>
          <p className="mt-2 text-2xl font-bold text-[--text-primary]">
            {stats.attendanceRate}%
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Scanner & Manual Entry Column */}
        <div className="space-y-6 lg:col-span-7">
          {/* Active Result Banner */}
          {lastResult && (
            <div
              role="alert"
              className={`rounded-2xl border p-5 shadow-sm transition-all ${
                lastResult.success && !lastResult.alreadyCheckedIn
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                  : lastResult.success && lastResult.alreadyCheckedIn
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
              }`}
            >
              <div className="flex items-start gap-3">
                {lastResult.success && !lastResult.alreadyCheckedIn ? (
                  <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : lastResult.success && lastResult.alreadyCheckedIn ? (
                  <AlertTriangle className="h-7 w-7 shrink-0 text-amber-600 dark:text-amber-400" />
                ) : (
                  <XCircle className="h-7 w-7 shrink-0 text-rose-600 dark:text-rose-400" />
                )}

                <div className="flex-1">
                  <h3 className="text-lg font-bold">
                    {lastResult.success && !lastResult.alreadyCheckedIn
                      ? 'Admitted: Check-In Confirmed!'
                      : lastResult.success && lastResult.alreadyCheckedIn
                        ? 'Notice: Already Checked In'
                        : 'Admission Denied'}
                  </h3>

                  {lastResult.attendeeName && (
                    <p className="mt-1 text-base font-semibold">
                      Attendee: {lastResult.attendeeName}
                    </p>
                  )}

                  {lastResult.alreadyCheckedIn && lastResult.checkedInAt && (
                    <p className="mt-1 text-xs">
                      First scanned at: {new Date(lastResult.checkedInAt).toLocaleTimeString()}
                    </p>
                  )}

                  {lastResult.error && (
                    <p className="mt-1 text-sm">{lastResult.error}</p>
                  )}

                  {lastResult.ticketCode && (
                    <p className="mt-2 font-mono text-xs opacity-75">
                      Code: {lastResult.ticketCode}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Camera Scanner Container */}
          <div className="overflow-hidden rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm">
            <div className="flex items-center justify-between border-b border-[--border-subtle] px-5 py-4">
              <div className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold text-[--text-primary]">Live QR Scanner</h2>
              </div>
              <Button
                type="button"
                variant={cameraActive ? 'destructive' : 'outline'}
                size="sm"
                onClick={cameraActive ? stopCamera : startCamera}
                className="gap-1.5"
              >
                {cameraActive ? (
                  <>
                    <CameraOff className="h-4 w-4" /> Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" /> Start Camera
                  </>
                )}
              </Button>
            </div>

            <div className="relative flex aspect-video w-full flex-col items-center justify-center bg-black">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                  {/* Target Crosshair Overlay */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-xl border-2 border-emerald-400/80 bg-emerald-500/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400">
                  <Camera className="h-12 w-12 stroke-[1.5] text-zinc-500" />
                  <p className="mt-3 text-sm font-medium">Camera is currently paused</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Click &ldquo;Start Camera&rdquo; to scan QR codes on attendee devices or badges.
                  </p>
                  <Button
                    type="button"
                    onClick={startCamera}
                    variant="outline"
                    size="sm"
                    className="mt-4 border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800"
                  >
                    Activate Camera
                  </Button>
                </div>
              )}
            </div>

            {cameraError && (
              <div className="border-t border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
                {cameraError}
              </div>
            )}
          </div>

          {/* Manual Code Input Form */}
          <div className="rounded-2xl border border-[--border-subtle] bg-[--bg-surface] p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[--text-primary]">
              Manual Ticket Code Entry
            </h2>
            <p className="mt-1 text-xs text-[--text-muted]">
              If a student is unable to scan their QR code, enter their code (e.g. CL-EVNT-12AB34CD-...)
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleProcessTicket(manualCode)
              }}
              className="mt-4 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Enter or paste ticket code..."
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  className="pl-9 font-mono uppercase text-sm"
                  disabled={isPending}
                />
              </div>

              <Button
                type="submit"
                disabled={isPending || !manualCode.trim()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
              >
                {isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <UserCheck className="h-4 w-4" />
                )}
                Check In
              </Button>
            </form>
          </div>
        </div>

        {/* Right: Real-time Scan Activity Feed */}
        <div className="lg:col-span-5">
          <div className="flex h-full flex-col rounded-2xl border border-[--border-subtle] bg-[--bg-surface] shadow-sm">
            <div className="flex items-center justify-between border-b border-[--border-subtle] px-5 py-4">
              <h2 className="font-semibold text-[--text-primary]">Door Activity Log</h2>
              <Badge variant="outline" className="text-xs">
                {scanLogs.length} scans
              </Badge>
            </div>

            <div className="flex-1 divide-y divide-[--border-subtle] overflow-y-auto p-2" style={{ maxHeight: '540px' }}>
              {scanLogs.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-[--text-muted]">
                  <UserCheck className="h-10 w-10 text-muted-foreground/50" />
                  <p className="mt-2 text-sm">No tickets scanned yet this session.</p>
                  <p className="text-xs">Scanned passes and status updates will appear here live.</p>
                </div>
              ) : (
                scanLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 text-sm">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : log.status === 'already_checked_in' ? (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold text-[--text-primary]">
                          {log.attendeeName || 'Unknown Attendee'}
                        </p>
                        <span className="font-mono text-[10px] text-[--text-muted]">
                          {log.time}
                        </span>
                      </div>
                      <p className="text-xs text-[--text-muted]">{log.message}</p>
                      <p className="font-mono text-[10px] text-[--text-muted] opacity-75">
                        {log.ticketCode}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
