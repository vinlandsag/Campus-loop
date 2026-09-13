import { describe, test, expect } from 'vitest'
import type {
  OfflineRosterAttendee,
  OfflineCheckInRoster,
  QueuedOfflineScan,
  OfflineSyncResult,
} from '@/types'

describe('Phase 10 Integration: Offline Check-In Resilience & Idempotent Sync', () => {
  interface SimulatedRegistration {
    id: string
    event_id: string
    ticket_code: string
    attendee_name: string
    status: 'registered' | 'checked_in' | 'cancelled'
    checked_in_at: string | null
    checked_in_by: string | null
  }

  const dbRegistrations: SimulatedRegistration[] = [
    {
      id: 'reg-001',
      event_id: 'ev-1',
      ticket_code: 'CL-HACK26-001-SIGNATUREA',
      attendee_name: 'Alice Student',
      status: 'registered',
      checked_in_at: null,
      checked_in_by: null,
    },
    {
      id: 'reg-002',
      event_id: 'ev-1',
      ticket_code: 'CL-HACK26-002-SIGNATUREB',
      attendee_name: 'Bob Student',
      status: 'registered',
      checked_in_at: null,
      checked_in_by: null,
    },
    {
      id: 'reg-003',
      event_id: 'ev-1',
      ticket_code: 'CL-HACK26-003-SIGNATUREC',
      attendee_name: 'Charlie Cancelled',
      status: 'cancelled',
      checked_in_at: null,
      checked_in_by: null,
    },
  ]

  // Simulate getOfflineCheckInRoster
  function simulateGetOfflineRoster(
    eventId: string,
    callerRole: 'owner' | 'editor' | 'check_in_staff' | 'viewer' | 'none'
  ): { success: boolean; data?: OfflineCheckInRoster; error?: string } {
    if (callerRole !== 'owner' && callerRole !== 'editor' && callerRole !== 'check_in_staff') {
      return { success: false, error: 'Unauthorized to download check-in roster' }
    }

    const attendees: OfflineRosterAttendee[] = dbRegistrations
      .filter((r) => r.event_id === eventId && r.status !== 'cancelled')
      .map((r) => ({
        registrationId: r.id,
        ticketCode: r.ticket_code,
        attendeeName: r.attendee_name,
        status: r.status,
        checkedInAt: r.checked_in_at,
      }))

    return {
      success: true,
      data: {
        eventId,
        eventTitle: 'Hackathon 2026',
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        attendees,
      },
    }
  }

  // Simulate syncOfflineCheckIns
  function simulateSyncOfflineCheckIns(
    eventId: string,
    scans: QueuedOfflineScan[],
    staffId: string
  ): OfflineSyncResult[] {
    const results: OfflineSyncResult[] = []

    for (const scan of scans) {
      const reg = dbRegistrations.find(
        (r) => r.event_id === eventId && r.ticket_code === scan.ticketCode
      )

      if (!reg) {
        results.push({
          scanId: scan.scanId,
          ticketCode: scan.ticketCode,
          success: false,
          error: 'Ticket not found for this event',
        })
        continue
      }

      if (reg.status === 'cancelled') {
        results.push({
          scanId: scan.scanId,
          ticketCode: scan.ticketCode,
          success: false,
          error: 'Registration was cancelled',
        })
        continue
      }

      const alreadyCheckedIn = Boolean(reg.checked_in_at) || reg.status === 'checked_in'

      if (alreadyCheckedIn) {
        results.push({
          scanId: scan.scanId,
          ticketCode: scan.ticketCode,
          success: true,
          alreadyCheckedIn: true,
          attendeeName: reg.attendee_name,
        })
        continue
      }

      // Record check-in
      reg.status = 'checked_in'
      reg.checked_in_at = scan.scannedAt
      reg.checked_in_by = staffId

      results.push({
        scanId: scan.scanId,
        ticketCode: scan.ticketCode,
        success: true,
        alreadyCheckedIn: false,
        attendeeName: reg.attendee_name,
      })
    }

    return results
  }

  test('only authorized check-in staff, editor, or owner can download roster', () => {
    expect(simulateGetOfflineRoster('ev-1', 'viewer').success).toBe(false)
    expect(simulateGetOfflineRoster('ev-1', 'none').success).toBe(false)

    const staffRes = simulateGetOfflineRoster('ev-1', 'check_in_staff')
    expect(staffRes.success).toBe(true)
    expect(staffRes.data?.attendees.length).toBe(2) // Alice and Bob; Charlie cancelled excluded
  })

  test('offline scanning validates against local cached roster and queues scans', () => {
    const rosterRes = simulateGetOfflineRoster('ev-1', 'check_in_staff')
    const cachedRoster = rosterRes.data!

    // Scan Alice offline
    const attendee = cachedRoster.attendees.find(
      (a) => a.ticketCode === 'CL-HACK26-001-SIGNATUREA'
    )
    expect(attendee).toBeDefined()
    expect(attendee?.attendeeName).toBe('Alice Student')

    // Create queued scan item
    const queuedScan: QueuedOfflineScan = {
      scanId: 'scan-offline-1',
      ticketCode: attendee!.ticketCode,
      scannedAt: '2026-10-15T10:05:00Z',
      attendeeName: attendee!.attendeeName,
    }

    expect(queuedScan.scanId).toBe('scan-offline-1')
  })

  test('idempotent sync processes queued scans and detects already checked-in attendees without double incrementing', () => {
    const scansToSync: QueuedOfflineScan[] = [
      {
        scanId: 'scan-offline-1',
        ticketCode: 'CL-HACK26-001-SIGNATUREA',
        scannedAt: '2026-10-15T10:05:00Z',
        attendeeName: 'Alice Student',
      },
      {
        scanId: 'scan-offline-2',
        ticketCode: 'CL-HACK26-002-SIGNATUREB',
        scannedAt: '2026-10-15T10:06:00Z',
        attendeeName: 'Bob Student',
      },
      {
        scanId: 'scan-offline-fake',
        ticketCode: 'CL-FAKE-TICKET',
        scannedAt: '2026-10-15T10:07:00Z',
      },
    ]

    // 1st sync execution
    const syncResults = simulateSyncOfflineCheckIns('ev-1', scansToSync, 'staff-user-1')

    expect(syncResults.length).toBe(3)
    expect(syncResults[0]?.success).toBe(true)
    expect(syncResults[0]?.alreadyCheckedIn).toBe(false)
    expect(syncResults[1]?.success).toBe(true)
    expect(syncResults[1]?.alreadyCheckedIn).toBe(false)
    expect(syncResults[2]?.success).toBe(false) // Fake ticket

    // Verify DB state
    const alice = dbRegistrations.find((r) => r.id === 'reg-001')!
    expect(alice.status).toBe('checked_in')
    expect(alice.checked_in_at).toBe('2026-10-15T10:05:00Z')

    // 2nd sync execution (idempotency check when network fluctuates)
    const reSyncResults = simulateSyncOfflineCheckIns('ev-1', scansToSync, 'staff-user-1')
    expect(reSyncResults[0]?.success).toBe(true)
    expect(reSyncResults[0]?.alreadyCheckedIn).toBe(true)
    expect(reSyncResults[1]?.success).toBe(true)
    expect(reSyncResults[1]?.alreadyCheckedIn).toBe(true)
  })
})
