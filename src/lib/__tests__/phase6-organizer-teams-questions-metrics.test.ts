import { describe, test, assert } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  canEditEvent,
  canManageTeam,
  canManageQuestions,
  canSendAnnouncements,
  canCheckIn,
  canViewParticipants,
  canExportCSV,
  canViewAnalytics,
  canDeleteEvent,
  canCancelEvent,
} from '../auth/teams'
import { sanitizeCsvCell, generateSafeCsv } from '../utils/csv'
import type { EventTeamRole, RegistrationQuestion } from '@/types'

describe('Phase 6: Scoped Organizer Team Roles & Permissions', () => {
  test('canManageTeam requires owner role', () => {
    assert.equal(canManageTeam('owner'), true, 'owner must be able to manage team')
    assert.equal(canManageTeam('editor'), false, 'editor must not manage team')
    assert.equal(canManageTeam('check_in_staff'), false, 'check-in staff must not manage team')
    assert.equal(canManageTeam('viewer'), false, 'viewer must not manage team')
    assert.equal(canManageTeam(null), false, 'unauthenticated / outsider must not manage team')
  })

  test('canEditEvent allows owner and editor only', () => {
    assert.equal(canEditEvent('owner'), true, 'owner can edit event')
    assert.equal(canEditEvent('editor'), true, 'editor can edit event')
    assert.equal(canEditEvent('check_in_staff'), false, 'check-in staff cannot edit event')
    assert.equal(canEditEvent('viewer'), false, 'viewer cannot edit event')
    assert.equal(canEditEvent(null), false, 'outsider cannot edit event')
  })

  test('canManageQuestions allows owner and editor only', () => {
    assert.equal(canManageQuestions('owner'), true, 'owner can manage questions')
    assert.equal(canManageQuestions('editor'), true, 'editor can manage questions')
    assert.equal(canManageQuestions('check_in_staff'), false, 'check-in staff cannot manage questions')
    assert.equal(canManageQuestions('viewer'), false, 'viewer cannot manage questions')
  })

  test('canSendAnnouncements allows owner and editor only', () => {
    assert.equal(canSendAnnouncements('owner'), true, 'owner can send announcements')
    assert.equal(canSendAnnouncements('editor'), true, 'editor can send announcements')
    assert.equal(canSendAnnouncements('check_in_staff'), false, 'check-in staff cannot send announcements')
    assert.equal(canSendAnnouncements('viewer'), false, 'viewer cannot send announcements')
  })

  test('canCheckIn allows owner, editor, and check-in staff', () => {
    assert.equal(canCheckIn('owner'), true, 'owner can check in attendees')
    assert.equal(canCheckIn('editor'), true, 'editor can check in attendees')
    assert.equal(canCheckIn('check_in_staff'), true, 'check-in staff can check in attendees')
    assert.equal(canCheckIn('viewer'), false, 'viewer cannot check in attendees')
    assert.equal(canCheckIn(null), false, 'outsider cannot check in attendees')
  })

  test('canViewParticipants allows all team roles but denies outsiders', () => {
    assert.equal(canViewParticipants('owner'), true)
    assert.equal(canViewParticipants('editor'), true)
    assert.equal(canViewParticipants('check_in_staff'), true)
    assert.equal(canViewParticipants('viewer'), true)
    assert.equal(canViewParticipants(null), false)
  })

  test('canExportCSV protects attendee PII from check-in staff volunteers', () => {
    assert.equal(canExportCSV('owner'), true, 'owner can export attendee CSV')
    assert.equal(canExportCSV('editor'), true, 'editor can export attendee CSV')
    assert.equal(canExportCSV('viewer'), true, 'viewer can export attendee CSV')
    assert.equal(canExportCSV('check_in_staff'), false, 'delegated check-in staff must NOT export full attendee list CSV')
    assert.equal(canExportCSV(null), false)
  })

  test('canViewAnalytics allows owner, editor, and viewer', () => {
    assert.equal(canViewAnalytics('owner'), true)
    assert.equal(canViewAnalytics('editor'), true)
    assert.equal(canViewAnalytics('viewer'), true)
    assert.equal(canViewAnalytics('check_in_staff'), false, 'check-in staff does not have analytics access')
  })

  test('canDeleteEvent and canCancelEvent are strictly reserved for owner', () => {
    const roles: (EventTeamRole | null)[] = ['editor', 'check_in_staff', 'viewer', null]
    for (const r of roles) {
      assert.equal(canDeleteEvent(r), false, `${r} must not delete event`)
      assert.equal(canCancelEvent(r), false, `${r} must not cancel event`)
    }
    assert.equal(canDeleteEvent('owner'), true, 'owner can delete event')
    assert.equal(canCancelEvent('owner'), true, 'owner can cancel event')
  })
})

describe('Phase 6: Safe CSV Export & Formula Injection Prevention (CWE-1236)', () => {
  test('sanitizeCsvCell returns standard text as-is enclosed in RFC quotes', () => {
    assert.equal(sanitizeCsvCell('Milan Patel'), '"Milan Patel"')
    assert.equal(sanitizeCsvCell('milan@university.edu'), '"milan@university.edu"')
    assert.equal(sanitizeCsvCell(12345), '"12345"')
    assert.equal(sanitizeCsvCell(true), '"true"')
    assert.equal(sanitizeCsvCell(null), '""')
    assert.equal(sanitizeCsvCell(undefined), '""')
  })

  test('sanitizeCsvCell neutralizes dangerous spreadsheet formula prefixes', () => {
    // Escapes formula prefixes (=, +, -, @, \t, \r) by prepending a single quote
    const formulaPayload = '=cmd|"/C calc"!A0'
    assert.equal(sanitizeCsvCell(formulaPayload), `"'=cmd|""/C calc""!A0"`)

    const plusPayload = '+SUM(A1:B10)'
    assert.equal(sanitizeCsvCell(plusPayload), `"'+SUM(A1:B10)"`)

    const minusPayload = '-2+3+cmd|'
    assert.equal(sanitizeCsvCell(minusPayload), `"'-2+3+cmd|"`)

    const atPayload = '@SUM(A1:B10)'
    assert.equal(sanitizeCsvCell(atPayload), `"'@SUM(A1:B10)"`)

    const tabPayload = '\tDDE("cmd";"/C calc")'
    assert.equal(sanitizeCsvCell(tabPayload), `"'\tDDE(""cmd"";""/C calc"")"`)

    const crPayload = '\r=1+1'
    assert.equal(sanitizeCsvCell(crPayload), `"'\r=1+1"`)
  })

  test('sanitizeCsvCell trims leading whitespace before checking for formula prefix', () => {
    const paddedPayload = '   =1+1'
    const result = sanitizeCsvCell(paddedPayload)
    assert.ok(result.startsWith(`"'`), 'Must neutralize formula with leading single quote inside quotes')
  })

  test('generateSafeCsv produces properly formatted RFC-4180 CSV with quotes and sanitized content', () => {
    const headers = ['Name', 'Email', 'Custom Answer', 'Status']
    const rows = [
      ['Alice', 'alice@campus.edu', 'Computer Science', 'registered'],
      ['Bob', 'bob@campus.edu', '=HYPERLINK("http://evil.com")', 'checked_in'],
      ['Charlie "The Champ"', 'charlie@campus.edu', 'Vegetarian, Vegan', 'registered'],
    ]

    const csv = generateSafeCsv(headers, rows)
    const lines = csv.split('\r\n')

    assert.equal(lines[0], '"Name","Email","Custom Answer","Status"')
    assert.equal(lines[1], '"Alice","alice@campus.edu","Computer Science","registered"')
    // Bob's formula must be sanitized with prepended single quote
    assert.ok(lines[2]?.includes(`"'=HYPERLINK`), 'Formula in Bob\'s answer must be neutralized')
    // Charlie's inner quotes must be double-escaped
    assert.ok(lines[3]?.includes('"Charlie ""The Champ"""'), 'Quotes must be escaped per RFC-4180')
    // Charlie's comma-separated answer must be enclosed in quotes
    assert.ok(lines[3]?.includes('"Vegetarian, Vegan"'))
  })
})

describe('Phase 6: Custom Registration Questions & Answer Validation', () => {
  const mockQuestions: RegistrationQuestion[] = [
    {
      id: 'q-dept',
      event_id: 'ev-1',
      question_text: 'What is your department / major?',
      question_type: 'select',
      options: ['Computer Science', 'Electrical Engineering', 'Mechanical Engineering', 'Business'],
      is_required: true,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'q-diet',
      event_id: 'ev-1',
      question_text: 'Any dietary restrictions?',
      question_type: 'text',
      options: null,
      is_required: false,
      sort_order: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'q-consent',
      event_id: 'ev-1',
      question_text: 'I agree to the campus event code of conduct',
      question_type: 'checkbox',
      options: null,
      is_required: true,
      sort_order: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ]

  function validateAnswers(
    questions: RegistrationQuestion[],
    answers: Record<string, string>
  ): { isValid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {}

    for (const q of questions) {
      const val = answers[q.id]?.trim() ?? ''
      if (q.is_required) {
        if (!val || (q.question_type === 'checkbox' && val !== 'true')) {
          errors[q.id] = `"${q.question_text}" is required.`
          continue
        }
      }

      if (val && q.question_type === 'select' && q.options && q.options.length > 0) {
        if (!q.options.includes(val)) {
          errors[q.id] = `Selected value is not a valid option.`
        }
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    }
  }

  test('validates required questions correctly', () => {
    // Missing required fields
    const invalidAnswers: Record<string, string> = {
      'q-diet': 'None',
    }
    const result1 = validateAnswers(mockQuestions, invalidAnswers)
    assert.equal(result1.isValid, false)
    assert.ok(result1.errors['q-dept'], 'Department is required')
    assert.ok(result1.errors['q-consent'], 'Code of conduct consent is required')

    // Valid complete answers
    const validAnswers: Record<string, string> = {
      'q-dept': 'Computer Science',
      'q-diet': 'Nut allergy',
      'q-consent': 'true',
    }
    const result2 = validateAnswers(mockQuestions, validAnswers)
    assert.equal(result2.isValid, true)
    assert.equal(Object.keys(result2.errors).length, 0)
  })

  test('rejects select options not present in predefined options', () => {
    const forgedOptionAnswers: Record<string, string> = {
      'q-dept': 'Fake Major From Another School',
      'q-consent': 'true',
    }
    const result = validateAnswers(mockQuestions, forgedOptionAnswers)
    assert.equal(result.isValid, false)
    assert.ok(result.errors['q-dept']?.includes('not a valid option'))
  })

  test('allows optional questions to be left empty', () => {
    const minimalAnswers: Record<string, string> = {
      'q-dept': 'Business',
      'q-consent': 'true',
    }
    const result = validateAnswers(mockQuestions, minimalAnswers)
    assert.equal(result.isValid, true)
  })
})

describe('Phase 6: Attendee Announcements Audience Scoping', () => {
  interface MockAttendee {
    user_id: string
    status: 'registered' | 'waitlisted' | 'cancelled'
    check_in_status: 'pending' | 'checked_in'
  }

  const mockAttendees: MockAttendee[] = [
    { user_id: 'usr-1', status: 'registered', check_in_status: 'pending' },
    { user_id: 'usr-2', status: 'registered', check_in_status: 'checked_in' },
    { user_id: 'usr-3', status: 'registered', check_in_status: 'pending' },
    { user_id: 'usr-4', status: 'waitlisted', check_in_status: 'pending' },
    { user_id: 'usr-5', status: 'cancelled', check_in_status: 'pending' },
  ]

  function filterAudience(
    targetAudience: 'all' | 'registered' | 'checked_in' | 'waitlisted',
    attendees: MockAttendee[]
  ): string[] {
    const recipients = attendees.filter((a) => {
      if (a.status === 'cancelled') return false
      switch (targetAudience) {
        case 'all':
          return a.status === 'registered' || a.status === 'waitlisted'
        case 'registered':
          return a.status === 'registered' && a.check_in_status !== 'checked_in'
        case 'checked_in':
          return a.status === 'registered' && a.check_in_status === 'checked_in'
        case 'waitlisted':
          return a.status === 'waitlisted'
        default:
          return false
      }
    })
    return Array.from(new Set(recipients.map((r) => r.user_id)))
  }

  test('targetAudience="all" targets all active attendees and waitlist, excluding cancelled', () => {
    const recipients = filterAudience('all', mockAttendees)
    assert.deepEqual(recipients, ['usr-1', 'usr-2', 'usr-3', 'usr-4'])
    assert.ok(!recipients.includes('usr-5'), 'Cancelled registrations must be excluded')
  })

  test('targetAudience="registered" targets confirmed registered who have not yet checked in', () => {
    const recipients = filterAudience('registered', mockAttendees)
    assert.deepEqual(recipients, ['usr-1', 'usr-3'])
    assert.ok(!recipients.includes('usr-2'), 'Already checked in attendee should not receive pending instructions')
  })

  test('targetAudience="checked_in" targets only verified attendees on site', () => {
    const recipients = filterAudience('checked_in', mockAttendees)
    assert.deepEqual(recipients, ['usr-2'])
  })

  test('targetAudience="waitlisted" targets only waitlisted attendees', () => {
    const recipients = filterAudience('waitlisted', mockAttendees)
    assert.deepEqual(recipients, ['usr-4'])
  })
})

describe('Phase 6: Attendance Metrics & Analytics Computation', () => {
  interface MockRegistration {
    id: string
    user_id: string
    status: 'registered' | 'waitlisted' | 'cancelled'
    check_in_status: 'pending' | 'checked_in'
    created_at: string
    updated_at: string
  }

  function computeEventMetrics(
    capacity: number | null,
    registrations: MockRegistration[],
    questionsCount: number,
    answersCount: number
  ) {
    const active = registrations.filter((r) => r.status === 'registered')
    const waitlisted = registrations.filter((r) => r.status === 'waitlisted')
    const cancelled = registrations.filter((r) => r.status === 'cancelled')
    const checkedIn = active.filter((r) => r.check_in_status === 'checked_in')

    const totalActive = active.length
    const totalCheckedIn = checkedIn.length
    const attendanceRate = totalActive > 0 ? Math.round((totalCheckedIn / totalActive) * 100) : 0
    const noShowCount = Math.max(0, totalActive - totalCheckedIn)
    const capacityUtilizationRate =
      capacity && capacity > 0 ? Math.min(100, Math.round((totalActive / capacity) * 100)) : null

    // Registrations by date
    const dateMap = new Map<string, number>()
    for (const r of registrations) {
      if (r.status === 'cancelled') continue
      const dateKey = r.created_at.split('T')[0] || 'Unknown'
      dateMap.set(dateKey, (dateMap.get(dateKey) || 0) + 1)
    }

    const registrationsOverTime = Array.from(dateMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalRegistrations: totalActive,
      totalWaitlist: waitlisted.length,
      totalCancelled: cancelled.length,
      totalCheckedIn,
      attendanceRate,
      noShowCount,
      capacityUtilizationRate,
      registrationsOverTime,
      customQuestionsCount: questionsCount,
      answersSubmittedCount: answersCount,
    }
  }

  const sampleRegistrations: MockRegistration[] = [
    { id: '1', user_id: 'u1', status: 'registered', check_in_status: 'checked_in', created_at: '2026-09-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z' },
    { id: '2', user_id: 'u2', status: 'registered', check_in_status: 'checked_in', created_at: '2026-09-01T11:00:00Z', updated_at: '2026-09-01T11:00:00Z' },
    { id: '3', user_id: 'u3', status: 'registered', check_in_status: 'pending', created_at: '2026-09-02T09:00:00Z', updated_at: '2026-09-02T09:00:00Z' },
    { id: '4', user_id: 'u4', status: 'registered', check_in_status: 'pending', created_at: '2026-09-02T12:00:00Z', updated_at: '2026-09-02T12:00:00Z' },
    { id: '5', user_id: 'u5', status: 'waitlisted', check_in_status: 'pending', created_at: '2026-09-03T10:00:00Z', updated_at: '2026-09-03T10:00:00Z' },
    { id: '6', user_id: 'u6', status: 'cancelled', check_in_status: 'pending', created_at: '2026-09-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
  ]

  test('computes accurate attendance and no-show metrics', () => {
    const metrics = computeEventMetrics(10, sampleRegistrations, 2, 4)

    assert.equal(metrics.totalRegistrations, 4, '4 active registered participants')
    assert.equal(metrics.totalWaitlist, 1, '1 waitlisted')
    assert.equal(metrics.totalCancelled, 1, '1 cancelled')
    assert.equal(metrics.totalCheckedIn, 2, '2 checked in')
    assert.equal(metrics.attendanceRate, 50, '2 out of 4 is 50% attendance rate')
    assert.equal(metrics.noShowCount, 2, '4 - 2 = 2 no shows')
    assert.equal(metrics.capacityUtilizationRate, 40, '4 / 10 capacity = 40%')
    assert.equal(metrics.customQuestionsCount, 2)
    assert.equal(metrics.answersSubmittedCount, 4)
  })

  test('groups registrations by date correctly for timeline charts', () => {
    const metrics = computeEventMetrics(10, sampleRegistrations, 0, 0)
    assert.deepEqual(metrics.registrationsOverTime, [
      { date: '2026-09-01', count: 2 }, // u1 and u2 (u6 cancelled excluded)
      { date: '2026-09-02', count: 2 }, // u3 and u4
      { date: '2026-09-03', count: 1 }, // u5 waitlisted
    ])
  })
})

describe('Phase 6: Database Migration & Schema Integrity', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260910240000_phase6_organizer_tools_teams_questions.sql'
  )

  test('migration file exists', () => {
    assert.ok(fs.existsSync(migrationPath), 'Migration file must exist')
  })

  test('migration creates event_team_members with role check constraints', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.event_team_members'))
    assert.ok(sql.includes("'owner', 'editor', 'check_in_staff', 'viewer'"))
    assert.ok(sql.includes('ENABLE ROW LEVEL SECURITY'))
  })

  test('migration creates event_registration_questions with supported question types', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.event_registration_questions'))
    assert.ok(sql.includes("'text', 'select', 'checkbox', 'textarea'"))
    assert.ok(sql.includes('options JSONB'))
    assert.ok(sql.includes('is_required BOOLEAN'))
  })

  test('migration creates registration_answers table with cascading foreign keys', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.registration_answers'))
    assert.ok(sql.includes('REFERENCES public.registrations(id) ON DELETE CASCADE'))
    assert.ok(sql.includes('REFERENCES public.event_registration_questions(id) ON DELETE CASCADE'))
  })

  test('migration creates event_announcements audit table and updates notifications check', () => {
    const sql = fs.readFileSync(migrationPath, 'utf8')
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.event_announcements'))
    assert.ok(sql.includes('notifications_type_check'))
    assert.ok(sql.includes("'announcement'"))
  })
})
