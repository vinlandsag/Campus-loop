import { describe, test, assert } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import {
  generateTicketCode,
  verifyTicketCodeSignature,
  getTicketSecret,
} from '@/lib/tickets/service'
import { canCheckIn } from '@/lib/auth/teams'

describe('Phase 9B: Ticket Signing Security & Timing Attacks', () => {
  const eventId = 'ev-9b-1111'
  const eventSlug = 'security-summit'
  const userId = 'usr-9b-2222'
  const registrationId = 'reg-9b-3333'

  test('generateTicketCode creates valid 4-part signed code', () => {
    const code = generateTicketCode(eventId, eventSlug, userId, registrationId)
    const parts = code.split('-')
    assert.equal(parts[0], 'CL')
    assert.equal(parts[1], 'SECURI')
    assert.equal(parts[2], registrationId.replace(/-/g, '').slice(0, 8).toUpperCase())
    assert.equal(parts[3]?.length, 8)
  })

  test('verifyTicketCodeSignature verifies genuine ticket and rejects tampered signature', () => {
    const validCode = generateTicketCode(eventId, eventSlug, userId, registrationId)
    assert.equal(verifyTicketCodeSignature(validCode, eventId, userId, registrationId), true)

    // Tampered signature
    const parts = validCode.split('-')
    parts[3] = 'DEADBEEF'
    const tamperedCode = parts.join('-')
    assert.equal(verifyTicketCodeSignature(tamperedCode, eventId, userId, registrationId), false)

    // Different event
    assert.equal(verifyTicketCodeSignature(validCode, 'different-event', userId, registrationId), false)

    // Different user
    assert.equal(verifyTicketCodeSignature(validCode, eventId, 'different-user', registrationId), false)

    // Different registration
    assert.equal(verifyTicketCodeSignature(validCode, eventId, userId, 'different-reg'), false)

    // Malformed codes
    assert.equal(verifyTicketCodeSignature('NOT-A-VALID-CODE', eventId, userId, registrationId), false)
    assert.equal(verifyTicketCodeSignature('CL-SHORT', eventId, userId, registrationId), false)
  })

  test('timing-safe verification handles different buffer lengths without throwing', () => {
    const validCode = generateTicketCode(eventId, eventSlug, userId, registrationId)
    const parts = validCode.split('-')

    // Shorter signature
    parts[3] = 'ABC'
    assert.equal(verifyTicketCodeSignature(parts.join('-'), eventId, userId, registrationId), false)

    // Longer signature
    parts[3] = 'ABCDEF123456'
    assert.equal(verifyTicketCodeSignature(parts.join('-'), eventId, userId, registrationId), false)
  })

  test('production mode fails closed if ticket signing secret is missing or uses weak fallback', () => {
    const mutableEnv = process.env as Record<string, string | undefined>
    const originalEnv = mutableEnv['NODE_ENV']
    const originalSecret = process.env.TICKET_SIGNING_SECRET
    const originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const originalNextAuth = process.env.NEXTAUTH_SECRET

    try {
      mutableEnv['NODE_ENV'] = 'production'
      delete process.env.TICKET_SIGNING_SECRET
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.NEXTAUTH_SECRET

      // Must throw when secrets are completely missing
      assert.throws(
        () => getTicketSecret(),
        /Ticket signing secret is missing/i
      )

      // Must throw when predictable fallback is configured
      process.env.TICKET_SIGNING_SECRET = 'campusloop-fallback-secret-2026'
      assert.throws(
        () => getTicketSecret(),
        /Predictable fallback secret cannot be used in production/i
      )

      // Verification fails closed when secret is missing in production
      delete process.env.TICKET_SIGNING_SECRET
      const isVerified = verifyTicketCodeSignature(
        'CL-TEST-12345678-ABCD1234',
        eventId,
        userId,
        registrationId
      )
      assert.equal(isVerified, false, 'Must fail closed when secret is missing')

      // Succeeds when strong production secret is supplied
      process.env.TICKET_SIGNING_SECRET = 'super-secure-production-hmac-key-2026!'
      assert.equal(getTicketSecret(), 'super-secure-production-hmac-key-2026!')
    } finally {
      mutableEnv['NODE_ENV'] = originalEnv
      if (originalSecret !== undefined) process.env.TICKET_SIGNING_SECRET = originalSecret
      else delete process.env.TICKET_SIGNING_SECRET
      if (originalServiceKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey
      else delete process.env.SUPABASE_SERVICE_ROLE_KEY
      if (originalNextAuth !== undefined) process.env.NEXTAUTH_SECRET = originalNextAuth
      else delete process.env.NEXTAUTH_SECRET
    }
  })
})

describe('Phase 9B: Check-in Authorization & Ticket Prefix Verification', () => {
  test('canCheckIn predicate enforces least-privilege event roles', () => {
    assert.equal(canCheckIn('owner'), true, 'Event owner must be permitted to check in attendees')
    assert.equal(canCheckIn('editor'), true, 'Event editor must be permitted to check in attendees')
    assert.equal(canCheckIn('check_in_staff'), true, 'Check-in staff must be permitted to check in attendees')
    assert.equal(canCheckIn('viewer'), false, 'Viewer role must NOT be permitted to check in attendees')
    assert.equal(canCheckIn(null), false, 'Non-team user must NOT be permitted to check in attendees')
  })

  test('ticket prefix matching rejects forged signatures', () => {
    const eventId = 'ev-target-1'
    const attendeeId = 'user-attendee-1'
    const regId = '9b1d4f2a-7777-4444-8888-abcdef123456'
    const regChunk = regId.replace(/-/g, '').slice(0, 8).toUpperCase()

    // Authentic code
    const authenticCode = generateTicketCode(eventId, 'SLUG', attendeeId, regId)

    // Forged code with valid prefix chunk but guessed signature
    const forgedCode = `CL-SLUG-${regChunk}-FAKE0000`

    assert.equal(
      verifyTicketCodeSignature(authenticCode, eventId, attendeeId, regId),
      true,
      'Authentic ticket must pass'
    )
    assert.equal(
      verifyTicketCodeSignature(forgedCode, eventId, attendeeId, regId),
      false,
      'Forged signature with matching chunk must be rejected'
    )
  })
})

describe('Phase 9B: Public Organizer Privacy Contract & Data Minimization', () => {
  interface DatabaseProfile {
    id: string
    role: 'student' | 'organizer' | 'admin'
    full_name: string
    email: string
    contact_email: string | null
    college: string | null
    department: string | null
    bio: string | null
    website_url: string | null
    instagram_handle: string | null
    campus_id: string | null
    is_verified: boolean
    show_email: boolean
    show_college: boolean
    show_department: boolean
  }

  function simulateOrganizerProfileView(profile: DatabaseProfile | null) {
    // Mirrors SQL View: WHERE role = 'organizer' AND is_verified = true
    if (!profile || profile.role !== 'organizer' || !profile.is_verified) {
      return null
    }

    return {
      id: profile.id,
      full_name: profile.full_name,
      avatar_url: null,
      is_verified: profile.is_verified,
      campus_id: profile.campus_id,
      bio: profile.bio,
      website_url: profile.website_url,
      instagram_handle: profile.instagram_handle,
      contact_email: profile.show_email ? profile.contact_email : null,
      college: profile.show_college ? profile.college : null,
      department: profile.show_department ? profile.department : null,
    }
  }

  test('unverified organizer or non-organizer cannot be viewed publicly', () => {
    const unverifiedOrganizer: DatabaseProfile = {
      id: 'org-unverified',
      role: 'organizer',
      full_name: 'Unverified Club',
      email: 'private-unverified@university.edu',
      contact_email: 'contact@unverified.org',
      college: 'College of Arts',
      department: 'English',
      bio: 'New club pending review',
      website_url: null,
      instagram_handle: null,
      campus_id: 'campus-1',
      is_verified: false,
      show_email: true,
      show_college: true,
      show_department: true,
    }

    const regularStudent: DatabaseProfile = {
      id: 'usr-student',
      role: 'student',
      full_name: 'Jane Student',
      email: 'jane@university.edu',
      contact_email: null,
      college: 'Engineering',
      department: 'CS',
      bio: 'Student bio',
      website_url: null,
      instagram_handle: null,
      campus_id: 'campus-1',
      is_verified: true,
      show_email: true,
      show_college: true,
      show_department: true,
    }

    assert.equal(simulateOrganizerProfileView(unverifiedOrganizer), null)
    assert.equal(simulateOrganizerProfileView(regularStudent), null)
  })

  test('private email is never exposed and sensitive fields respect opt-in flags', () => {
    const verifiedOrganizer: DatabaseProfile = {
      id: 'org-verified-1',
      role: 'organizer',
      full_name: 'ACM Student Chapter',
      email: 'organizer-personal-account@university.edu',
      contact_email: 'inquiries@acmchapter.org',
      college: 'College of Computing',
      department: 'Computer Science',
      bio: 'Premier computing organization',
      website_url: 'https://acmchapter.org',
      instagram_handle: '@acmchapter',
      campus_id: 'campus-1',
      is_verified: true,
      show_email: false,
      show_college: false,
      show_department: false,
    }

    // With show_* = false: contact_email, college, department are masked
    const masked = simulateOrganizerProfileView(verifiedOrganizer)
    assert.ok(masked)
    assert.equal(masked!.full_name, 'ACM Student Chapter')
    assert.equal(masked!.contact_email, null, 'Contact email must be masked when show_email=false')
    assert.equal(masked!.college, null, 'College must be masked when show_college=false')
    assert.equal(masked!.department, null, 'Department must be masked when show_department=false')
    assert.equal((masked as Record<string, unknown>)['email'], undefined, 'Private personal email must never exist in view')

    // With show_* = true: public contact details are shown
    verifiedOrganizer.show_email = true
    verifiedOrganizer.show_college = true
    verifiedOrganizer.show_department = true

    const revealed = simulateOrganizerProfileView(verifiedOrganizer)
    assert.ok(revealed)
    assert.equal(revealed!.contact_email, 'inquiries@acmchapter.org')
    assert.equal(revealed!.college, 'College of Computing')
    assert.equal(revealed!.department, 'Computer Science')
  })
})

describe('Phase 9B: Draft Event Questions Privacy', () => {
  function simulateCanViewQuestions(
    event: { id: string; status: 'published' | 'draft' | 'cancelled'; organizer_id: string },
    user: { id: string; roleInTeam: string | null } | null
  ): boolean {
    // If event is published, anyone can view questions
    if (event.status === 'published') return true

    // If event is unpublished (draft), only organizer or authorized team members can view
    if (!user) return false
    if (event.organizer_id === user.id) return true
    if (user.roleInTeam === 'owner' || user.roleInTeam === 'editor') return true

    return false
  }

  test('published event questions are viewable publicly', () => {
    const event = { id: 'ev-pub', status: 'published' as const, organizer_id: 'org-1' }
    assert.equal(simulateCanViewQuestions(event, null), true)
  })

  test('draft event questions are hidden from public and unauthorized users', () => {
    const draftEvent = { id: 'ev-draft', status: 'draft' as const, organizer_id: 'org-1' }

    // Anonymous visitor
    assert.equal(simulateCanViewQuestions(draftEvent, null), false)

    // Unrelated logged in user
    assert.equal(simulateCanViewQuestions(draftEvent, { id: 'usr-unrelated', roleInTeam: null }), false)

    // Event organizer / owner
    assert.equal(simulateCanViewQuestions(draftEvent, { id: 'org-1', roleInTeam: 'owner' }), true)

    // Event team editor
    assert.equal(simulateCanViewQuestions(draftEvent, { id: 'team-editor', roleInTeam: 'editor' }), true)
  })
})

describe('Phase 9B: Notification Forgery Prevention RLS Specification', () => {
  function simulateNotificationInsertPolicy(
    caller: { id: string; role: 'authenticated' | 'service_role' },
    notification: {
      user_id: string
      event_id: string | null
      type: string
    },
    eventTeamRole: string | null,
    isEventOwner: boolean
  ): boolean {
    // 1. Service role can insert anything
    if (caller.role === 'service_role') return true

    // 2. User self-notification for specific allowed transaction types
    if (
      caller.id === notification.user_id &&
      ['registration_confirmed', 'waitlist_joined', 'registration_cancelled'].includes(notification.type)
    ) {
      return true
    }

    // 3. Event organizer or authorized team staff notifying attendees
    if (notification.event_id && (isEventOwner || ['owner', 'editor', 'check_in_staff'].includes(eventTeamRole || ''))) {
      return true
    }

    return false
  }

  test('arbitrary user cannot forge notification for another user', () => {
    const attacker = { id: 'attacker-1', role: 'authenticated' as const }
    const victimNotification = {
      user_id: 'victim-99',
      event_id: null,
      type: 'broadcast',
    }

    const allowed = simulateNotificationInsertPolicy(attacker, victimNotification, null, false)
    assert.equal(allowed, false, 'Attacker cannot forge notification for victim')
  })

  test('user can trigger self-notification for legitimate registration confirmation', () => {
    const user = { id: 'user-self', role: 'authenticated' as const }
    const selfNotification = {
      user_id: 'user-self',
      event_id: 'ev-1',
      type: 'registration_confirmed',
    }

    const allowed = simulateNotificationInsertPolicy(user, selfNotification, null, false)
    assert.equal(allowed, true, 'Self-registration notification must be permitted')
  })

  test('organizer can send notifications to attendees for their events', () => {
    const organizer = { id: 'org-lead', role: 'authenticated' as const }
    const attendeeNotification = {
      user_id: 'attendee-55',
      event_id: 'ev-host-1',
      type: 'event_update',
    }

    const allowed = simulateNotificationInsertPolicy(organizer, attendeeNotification, 'owner', true)
    assert.equal(allowed, true, 'Event owner can send event notifications to attendees')
  })
})

describe('Phase 9B: SQL Migration Artifact Validation', () => {
  const migrationPath = path.resolve(
    process.cwd(),
    'supabase/migrations/20260912100000_phase9b_security_privacy_hardening.sql'
  )

  test('Phase 9B migration file exists and contains all required security directives', () => {
    assert.ok(fs.existsSync(migrationPath), 'Migration file must exist')
    const sql = fs.readFileSync(migrationPath, 'utf-8')

    // 1. Notification RLS policy
    assert.ok(sql.includes('Privileged or authorized event notifications'), 'Must define least-privilege notification policy')
    assert.ok(sql.includes("DROP POLICY IF EXISTS \"System can insert notifications\" ON public.notifications"), 'Must drop loose system policy')

    // 2. Questions RLS policy
    assert.ok(sql.includes('Read registration questions for published events or by event team'), 'Must restrict question view to published or team')
    assert.ok(sql.includes("status = 'published'"), 'Must check published event status in question policy')

    // 3. Organizer profile privacy
    assert.ok(sql.includes('show_college BOOLEAN NOT NULL DEFAULT false'), 'Must add show_college column')
    assert.ok(sql.includes('show_department BOOLEAN NOT NULL DEFAULT false'), 'Must add show_department column')
    assert.ok(sql.includes('show_email BOOLEAN NOT NULL DEFAULT false'), 'Must add show_email column')
    assert.ok(sql.includes("WHERE role = 'organizer' AND is_verified = true"), 'organizer_profiles must filter verified organizers only')

    // 4. Security-definer least privilege & authorization
    assert.ok(sql.includes('promote_next_waitlisted_attendee'), 'Must harden promote_next_waitlisted_attendee')
    assert.ok(sql.includes('check_in_attendee'), 'Must harden check_in_attendee')
    assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.promote_next_waitlisted_attendee'), 'Must revoke execute from public')
    assert.ok(sql.includes('REVOKE EXECUTE ON FUNCTION public.check_in_attendee'), 'Must revoke execute from public')
    assert.ok(sql.includes('SET search_path = public'), 'Must pin search_path in security-definer functions')
  })
})
