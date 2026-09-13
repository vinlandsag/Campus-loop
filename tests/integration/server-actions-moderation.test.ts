import { describe, test, expect } from 'vitest'
import type { ModerationReport, ModerationReportStatus, ModerationReportReason, ModerationTargetType } from '@/types'

describe('Phase 10 Integration: Moderation Reports & Abuse Rate Limiting', () => {
  const reportsDb: ModerationReport[] = []
  const MAX_REPORTS_PER_DAY = 5

  function simulateSubmitReport(
    userId: string,
    targetType: ModerationTargetType,
    targetId: string,
    reason: ModerationReportReason,
    details?: string | null,
    mockNow = Date.now()
  ): { success: boolean; data?: ModerationReport; error?: string } {
    const oneDayAgo = mockNow - 24 * 60 * 60 * 1000

    // Rate limit 1: User daily report count
    const userReportsToday = reportsDb.filter(
      (r) => r.reporter_id === userId && new Date(r.created_at).getTime() >= oneDayAgo
    )

    if (userReportsToday.length >= MAX_REPORTS_PER_DAY) {
      return {
        success: false,
        error: 'You have reached the limit of 5 reports per 24 hours. Please wait before submitting additional reports.',
      }
    }

    // Rate limit 2: Deduplication per target per 24h
    const existingTargetReport = reportsDb.find(
      (r) =>
        r.reporter_id === userId &&
        r.target_type === targetType &&
        r.target_id === targetId &&
        new Date(r.created_at).getTime() >= oneDayAgo
    )

    if (existingTargetReport) {
      return {
        success: false,
        error: `You have already submitted a report for this ${targetType} within the last 24 hours. Our moderation team is actively reviewing it.`,
      }
    }

    const report: ModerationReport = {
      id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      reporter_id: userId,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
      status: 'pending',
      created_at: new Date(mockNow).toISOString(),
    }

    reportsDb.push(report)
    return { success: true, data: report }
  }

  function simulateUpdateReportStatus(
    adminId: string,
    adminRole: string,
    reportId: string,
    status: ModerationReportStatus,
    adminNotes?: string
  ): { success: boolean; data?: ModerationReport; error?: string } {
    if (adminRole !== 'admin') {
      return { success: false, error: 'Only administrators can update moderation reports.' }
    }

    const report = reportsDb.find((r) => r.id === reportId)
    if (!report) {
      return { success: false, error: 'Report not found' }
    }

    report.status = status
    report.reviewed_by = adminId
    report.reviewed_at = new Date().toISOString()
    if (adminNotes !== undefined) {
      report.admin_notes = adminNotes
    }

    return { success: true, data: report }
  }

  test('students can report unsafe or spam events', () => {
    const res = simulateSubmitReport(
      'std-1',
      'event',
      'event-scam-1',
      'spam',
      'This event is commercial advertising selling external courses.'
    )
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('pending')
    expect(res.data?.target_type).toBe('event')
  })

  test('students can report abusive organizers', () => {
    const res = simulateSubmitReport(
      'std-1',
      'organizer',
      'org-imposter-1',
      'fraud',
      'Club pretending to be official university chapter.'
    )
    expect(res.success).toBe(true)
    expect(res.data?.target_type).toBe('organizer')
  })

  test('duplicate report for same target within 24h is rejected with friendly message', () => {
    const dupRes = simulateSubmitReport(
      'std-1',
      'event',
      'event-scam-1',
      'misleading',
      'Second report trying to spam queue'
    )
    expect(dupRes.success).toBe(false)
    expect(dupRes.error).toContain('already submitted a report for this event within the last 24 hours')
  })

  test('abuse rate limit enforces max 5 reports per user per 24 hours', () => {
    const testUser = 'abusive-user-99'

    // Submit 5 valid distinct reports
    for (let i = 1; i <= 5; i++) {
      const res = simulateSubmitReport(testUser, 'event', `event-target-${i}`, 'other', `Report ${i}`)
      expect(res.success).toBe(true)
    }

    // 6th report within 24h is rate limited
    const sixthRes = simulateSubmitReport(testUser, 'event', 'event-target-6', 'other', '6th report')
    expect(sixthRes.success).toBe(false)
    expect(sixthRes.error).toContain('limit of 5 reports per 24 hours')
  })

  test('admin can inspect report, update status and append resolution notes', () => {
    const reportId = reportsDb[0]!.id

    // Non-admin rejected
    const nonAdminRes = simulateUpdateReportStatus('std-1', 'student', reportId, 'action_taken')
    expect(nonAdminRes.success).toBe(false)

    // Admin allowed
    const adminRes = simulateUpdateReportStatus(
      'admin-super',
      'admin',
      reportId,
      'action_taken',
      'Verified spam listing. Event unlisted and organizer warned.'
    )
    expect(adminRes.success).toBe(true)
    expect(adminRes.data?.status).toBe('action_taken')
    expect(adminRes.data?.admin_notes).toContain('Verified spam listing')
  })
})

describe('Phase 10 Integration: Organizer Review & Approval Queue', () => {
  interface MockProfile {
    id: string
    email: string
    full_name: string
    role: 'student' | 'organizer' | 'admin'
    is_verified: boolean
    campus_id?: string
  }

  interface MockNotification {
    user_id: string
    type: string
    title: string
    message: string
  }

  const profilesDb: MockProfile[] = [
    {
      id: 'org-pending-1',
      email: 'acm@university.edu',
      full_name: 'ACM Student Chapter',
      role: 'organizer',
      is_verified: false,
      campus_id: 'campus-1',
    },
    {
      id: 'org-pending-2',
      email: 'robotics@university.edu',
      full_name: 'Robotics Society',
      role: 'organizer',
      is_verified: false,
      campus_id: 'campus-1',
    },
    {
      id: 'org-verified-1',
      email: 'ieee@university.edu',
      full_name: 'IEEE Branch',
      role: 'organizer',
      is_verified: true,
      campus_id: 'campus-1',
    },
    {
      id: 'std-user-1',
      email: 'student@university.edu',
      full_name: 'Jane Student',
      role: 'student',
      is_verified: false,
      campus_id: 'campus-1',
    },
  ]

  const notifsDb: MockNotification[] = []

  function simulateGetPendingOrganizers(callerRole: string) {
    if (callerRole !== 'admin') {
      return { success: false, error: 'Only administrators can access the organizer verification queue.' }
    }
    const pending = profilesDb.filter((p) => p.role === 'organizer' && !p.is_verified)
    return { success: true, data: pending }
  }

  function simulateApproveOrganizer(callerRole: string, organizerId: string) {
    if (callerRole !== 'admin') {
      return { success: false, error: 'Only administrators can approve organizers.' }
    }

    const org = profilesDb.find((p) => p.id === organizerId)
    if (!org) return { success: false, error: 'Organizer not found' }

    org.is_verified = true
    notifsDb.push({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Account Approved!',
      message: 'Congratulations! Your campus club organizer account has been approved.',
    })

    return { success: true, data: { id: organizerId } }
  }

  function simulateRejectOrganizer(callerRole: string, organizerId: string, reason?: string) {
    if (callerRole !== 'admin') {
      return { success: false, error: 'Only administrators can reject organizer applications.' }
    }

    const org = profilesDb.find((p) => p.id === organizerId)
    if (!org) return { success: false, error: 'Organizer not found' }

    org.role = 'student'
    org.is_verified = false
    notifsDb.push({
      user_id: organizerId,
      type: 'announcement',
      title: 'Organizer Application Update',
      message: reason || 'Application rejected. Account reverted to student.',
    })

    return { success: true, data: { id: organizerId } }
  }

  test('non-admins cannot access pending organizer review queue', () => {
    const studentRes = simulateGetPendingOrganizers('student')
    expect(studentRes.success).toBe(false)
    expect(studentRes.error).toContain('Only administrators')

    const organizerRes = simulateGetPendingOrganizers('organizer')
    expect(organizerRes.success).toBe(false)
    expect(organizerRes.error).toContain('Only administrators')
  })

  test('admin can retrieve all pending unverified club organizers', () => {
    const adminRes = simulateGetPendingOrganizers('admin')
    expect(adminRes.success).toBe(true)
    expect(adminRes.data?.length).toBe(2)
    expect(adminRes.data?.map((o) => o.email)).toEqual(['acm@university.edu', 'robotics@university.edu'])
  })

  test('admin can approve pending organizer: grants verified status and notifies organizer', () => {
    const approveRes = simulateApproveOrganizer('admin', 'org-pending-1')
    expect(approveRes.success).toBe(true)

    const updatedProfile = profilesDb.find((p) => p.id === 'org-pending-1')
    expect(updatedProfile?.is_verified).toBe(true)
    expect(updatedProfile?.role).toBe('organizer')

    const sentNotification = notifsDb.find((n) => n.user_id === 'org-pending-1')
    expect(sentNotification?.title).toBe('Organizer Account Approved!')
  })

  test('non-admin attempting to approve organizer fails closed', () => {
    const rogueRes = simulateApproveOrganizer('student', 'org-pending-2')
    expect(rogueRes.success).toBe(false)

    const unverifiedProfile = profilesDb.find((p) => p.id === 'org-pending-2')
    expect(unverifiedProfile?.is_verified).toBe(false)
  })

  test('admin can reject organizer request: demotes role to student and notifies applicant', () => {
    const rejectRes = simulateRejectOrganizer(
      'admin',
      'org-pending-2',
      'Please submit an official faculty advisor letter.'
    )
    expect(rejectRes.success).toBe(true)

    const rejectedProfile = profilesDb.find((p) => p.id === 'org-pending-2')
    expect(rejectedProfile?.role).toBe('student')
    expect(rejectedProfile?.is_verified).toBe(false)

    const sentNotification = notifsDb.find((n) => n.user_id === 'org-pending-2')
    expect(sentNotification?.message).toContain('faculty advisor letter')
  })
})

