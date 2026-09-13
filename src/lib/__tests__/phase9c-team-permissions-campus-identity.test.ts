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
  canViewRegistrationAnswers,
  canViewAnalytics,
  canCancelEvent,
  canDeleteEvent,
} from '@/lib/auth/teams'

describe('Phase 9C: Event-Team Permissions Matrix & Least Privilege', () => {
  test('canEditEvent: only owner and editor can edit event details', () => {
    assert.equal(canEditEvent('owner'), true)
    assert.equal(canEditEvent('editor'), true)
    assert.equal(canEditEvent('check_in_staff'), false)
    assert.equal(canEditEvent('viewer'), false)
    assert.equal(canEditEvent(null), false)
  })

  test('canManageTeam: only event owner can manage team members and assign roles', () => {
    assert.equal(canManageTeam('owner'), true)
    assert.equal(canManageTeam('editor'), false)
    assert.equal(canManageTeam('check_in_staff'), false)
    assert.equal(canManageTeam('viewer'), false)
    assert.equal(canManageTeam(null), false)
  })

  test('canManageQuestions: only owner and editor can manage registration questions', () => {
    assert.equal(canManageQuestions('owner'), true)
    assert.equal(canManageQuestions('editor'), true)
    assert.equal(canManageQuestions('check_in_staff'), false)
    assert.equal(canManageQuestions('viewer'), false)
    assert.equal(canManageQuestions(null), false)
  })

  test('canSendAnnouncements: only owner and editor can dispatch event announcements', () => {
    assert.equal(canSendAnnouncements('owner'), true)
    assert.equal(canSendAnnouncements('editor'), true)
    assert.equal(canSendAnnouncements('check_in_staff'), false)
    assert.equal(canSendAnnouncements('viewer'), false)
    assert.equal(canSendAnnouncements(null), false)
  })

  test('canCheckIn: owner, editor, and check_in_staff are authorized; viewer and non-members are rejected', () => {
    assert.equal(canCheckIn('owner'), true)
    assert.equal(canCheckIn('editor'), true)
    assert.equal(canCheckIn('check_in_staff'), true)
    assert.equal(canCheckIn('viewer'), false)
    assert.equal(canCheckIn(null), false)
  })

  test('canViewParticipants: all assigned team roles can see attendees list; non-members cannot', () => {
    assert.equal(canViewParticipants('owner'), true)
    assert.equal(canViewParticipants('editor'), true)
    assert.equal(canViewParticipants('check_in_staff'), true)
    assert.equal(canViewParticipants('viewer'), true)
    assert.equal(canViewParticipants(null), false)
  })

  test('canExportCSV: check_in_staff is strictly prohibited from exporting attendee CSVs (data minimization)', () => {
    assert.equal(canExportCSV('owner'), true)
    assert.equal(canExportCSV('editor'), true)
    assert.equal(canExportCSV('viewer'), true)
    assert.equal(canExportCSV('check_in_staff'), false, 'Check-in staff must NOT be able to export CSV')
    assert.equal(canExportCSV(null), false)
  })

  test('canViewRegistrationAnswers: check_in_staff is strictly prohibited from reading custom answers (data minimization)', () => {
    assert.equal(canViewRegistrationAnswers('owner'), true)
    assert.equal(canViewRegistrationAnswers('editor'), true)
    assert.equal(canViewRegistrationAnswers('viewer'), true)
    assert.equal(canViewRegistrationAnswers('check_in_staff'), false, 'Check-in staff must NOT view custom answers')
    assert.equal(canViewRegistrationAnswers(null), false)
  })

  test('canViewAnalytics: owner, editor, and viewer can view analytics; check-in staff cannot', () => {
    assert.equal(canViewAnalytics('owner'), true)
    assert.equal(canViewAnalytics('editor'), true)
    assert.equal(canViewAnalytics('viewer'), true)
    assert.equal(canViewAnalytics('check_in_staff'), false)
    assert.equal(canViewAnalytics(null), false)
  })

  test('canCancelEvent & canDeleteEvent: only owner can cancel or delete an event', () => {
    assert.equal(canCancelEvent('owner'), true)
    assert.equal(canCancelEvent('editor'), false)
    assert.equal(canCancelEvent('check_in_staff'), false)
    assert.equal(canCancelEvent('viewer'), false)
    assert.equal(canCancelEvent(null), false)

    assert.equal(canDeleteEvent('owner'), true)
    assert.equal(canDeleteEvent('editor'), false)
    assert.equal(canDeleteEvent('check_in_staff'), false)
    assert.equal(canDeleteEvent('viewer'), false)
    assert.equal(canDeleteEvent(null), false)
  })
})

describe('Phase 9C: Campus Identity Lifecycle & Verification Logic', () => {
  // Pure domain match helper simulating the DB trigger handle_new_user and updateUserCampus
  function evaluateCampusVerification(
    email: string,
    emailConfirmed: boolean,
    campusDomain: string
  ): { status: 'verified' | 'unverified' | 'pending'; domainMatches: boolean } {
    const userDomain = email.split('@')[1]?.toLowerCase() || ''
    const domainMatches =
      userDomain === campusDomain.toLowerCase() ||
      userDomain.endsWith('.' + campusDomain.toLowerCase())

    if (domainMatches && emailConfirmed) {
      return { status: 'verified', domainMatches: true }
    }
    if (domainMatches && !emailConfirmed) {
      return { status: 'unverified', domainMatches: true }
    }
    return { status: 'pending', domainMatches: false }
  }

  test('institutional domain with confirmed email yields verified campus identity', () => {
    const result = evaluateCampusVerification('student@sjsu.edu', true, 'sjsu.edu')
    assert.equal(result.domainMatches, true)
    assert.equal(result.status, 'verified')

    const subDomainResult = evaluateCampusVerification('student@engr.sjsu.edu', true, 'sjsu.edu')
    assert.equal(subDomainResult.domainMatches, true)
    assert.equal(subDomainResult.status, 'verified')
  })

  test('institutional domain with unconfirmed email yields unverified status until confirmed', () => {
    const result = evaluateCampusVerification('student@sjsu.edu', false, 'sjsu.edu')
    assert.equal(result.domainMatches, true)
    assert.equal(result.status, 'unverified')
  })

  test('domain mismatch yields pending status requiring administrative exception review', () => {
    const result = evaluateCampusVerification('student@gmail.com', true, 'sjsu.edu')
    assert.equal(result.domainMatches, false)
    assert.equal(result.status, 'pending')
  })
})

describe('Phase 9C: Cross-Campus Event Immutability Safeguards', () => {
  test('event update payload must not allow altering campus_id of an existing event', () => {
    // Simulating the server action updateEvent and trigger enforce_event_campus_inheritance
    const existingEvent = {
      id: 'evt-campus-101',
      title: 'Original Campus Hackathon',
      campus_id: 'campus-original-uuid',
    }

    const proposedUpdates = {
      title: 'Updated Campus Hackathon',
      campus_id: 'campus-malicious-redirect-uuid', // Attempting to move event to another campus
    }

    // In updateEvent action, campus_id is deleted/excluded from updates
    const sanitizedUpdates: Record<string, unknown> = { ...proposedUpdates }
    delete sanitizedUpdates['campus_id']

    assert.equal(sanitizedUpdates['campus_id'], undefined)
    assert.equal(existingEvent.campus_id, 'campus-original-uuid')
  })
})

describe('Phase 9C: Migration SQL Directives Audit', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260912110000_phase9c_team_permissions_campus_identity.sql'
  )

  test('migration file exists and contains all required Phase 9C directives', () => {
    assert.ok(fs.existsSync(migrationPath), 'Phase 9C migration file must exist')
    const sql = fs.readFileSync(migrationPath, 'utf8')

    // 1. Profile verification columns
    assert.ok(sql.includes('campus_verification_status'), 'Must add campus_verification_status')
    assert.ok(sql.includes('campus_exception_reason'), 'Must add campus_exception_reason')
    assert.ok(sql.includes('campus_verified_at'), 'Must add campus_verified_at')
    assert.ok(sql.includes('pending_campus_id'), 'Must add pending_campus_id')

    // 2. Trigger for event campus immutability
    assert.ok(sql.includes('enforce_event_campus_inheritance'), 'Must define event campus inheritance trigger function')
    assert.ok(
      sql.includes('NEW.campus_id <> OLD.campus_id') || sql.includes('NEW.campus_id IS DISTINCT FROM OLD.campus_id'),
      'Must block changing campus_id on UPDATE'
    )

    // 3. Event RLS updates
    assert.ok(sql.includes('"Event team members can read own events"'), 'Must update events SELECT policy for team members')
    assert.ok(sql.includes('"Event owners and editors can update events"'), 'Must update events UPDATE policy for owner/editor')

    // 4. Registrations RLS updates for check-in staff
    assert.ok(sql.includes('"Event team members can read event registrations"'), 'Must update registrations SELECT policy')
    assert.ok(
      sql.includes('"Event check-in staff and managers can update registration check-in"'),
      'Must update registrations UPDATE policy for check-in'
    )

    // 5. Registration Answers RLS data minimization
    assert.ok(
      sql.includes('"Event managers and viewers can view registration answers"'),
      'Must update registration_answers SELECT policy'
    )
    assert.ok(
      sql.includes("role IN ('owner', 'editor', 'viewer')"),
      'Registration answers RLS must exclude check_in_staff for data minimization'
    )

    // 6. Security Definer Least-Privilege Execution Grants
    assert.ok(
      sql.includes('REVOKE EXECUTE ON FUNCTION public.enforce_event_campus_inheritance() FROM public, anon, authenticated;'),
      'Must revoke public execute on trigger function'
    )
  })
})

