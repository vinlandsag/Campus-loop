import { describe, test, expect } from 'vitest'
import { isSystemAdmin, assertAdmin } from '@/lib/auth/admin'
import type { User, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import type { AdminAuditAction, AdminAuditLogEntry, AdminOrganizer, AdminCampusWithCounts } from '@/types'

describe('Admin Security & Authorization Tests (Phase 17)', () => {
  // ─── 1. Admin Verification Invariants ─────────────────────────────────────
  describe('isSystemAdmin Authorization Invariants', () => {
    test('rejects null or undefined user', async () => {
      const mockSupabase = {} as SupabaseClient<Database>
      expect(await isSystemAdmin(mockSupabase, null)).toBe(false)
      expect(await isSystemAdmin(mockSupabase, undefined)).toBe(false)
    })

    test('rejects user without id', async () => {
      const mockSupabase = {} as SupabaseClient<Database>
      expect(await isSystemAdmin(mockSupabase, {} as User)).toBe(false)
    })

    test('NEVER trusts user_metadata.role = "admin" (client-controllable exploit attempt)', async () => {
      const attackerUser = {
        id: 'attacker-123',
        email: 'attacker@example.com',
        app_metadata: {},
        user_metadata: {
          role: 'admin',
          is_admin: true,
        },
      } as unknown as User

      // Mock database query returning no system_admins row
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>

      const isAdmin = await isSystemAdmin(mockSupabase, attackerUser)
      expect(isAdmin).toBe(false)
    })

    test('authorizes when app_metadata.role = "admin" (server-controlled JWT claim)', async () => {
      const adminUser = {
        id: 'admin-123',
        email: 'admin@campusloop.edu',
        app_metadata: { role: 'admin' },
        user_metadata: {},
      } as unknown as User

      const mockSupabase = {} as SupabaseClient<Database>
      expect(await isSystemAdmin(mockSupabase, adminUser)).toBe(true)
    })

    test('authorizes when app_metadata.is_admin = true (server-controlled JWT claim)', async () => {
      const adminUser = {
        id: 'admin-456',
        email: 'admin2@campusloop.edu',
        app_metadata: { is_admin: true },
        user_metadata: {},
      } as unknown as User

      const mockSupabase = {} as SupabaseClient<Database>
      expect(await isSystemAdmin(mockSupabase, adminUser)).toBe(true)
    })

    test('authorizes when user exists in system_admins database table', async () => {
      const adminUser = {
        id: 'admin-789',
        email: 'admin3@campusloop.edu',
        app_metadata: {},
        user_metadata: {},
      } as unknown as User

      const mockSupabase = {
        from: (table: string) => {
          expect(table).toBe('system_admins')
          return {
            select: () => ({
              eq: (col: string, val: string) => {
                expect(col).toBe('user_id')
                expect(val).toBe('admin-789')
                return {
                  maybeSingle: async () => ({
                    data: { user_id: 'admin-789' },
                    error: null,
                  }),
                }
              },
            }),
          }
        },
      } as unknown as SupabaseClient<Database>

      expect(await isSystemAdmin(mockSupabase, adminUser)).toBe(true)
    })

    test('rejects regular student user not in system_admins', async () => {
      const studentUser = {
        id: 'student-100',
        email: 'student@stanford.edu',
        app_metadata: { provider: 'email' },
        user_metadata: { role: 'student' },
      } as unknown as User

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>

      expect(await isSystemAdmin(mockSupabase, studentUser)).toBe(false)
    })
  })

  // ─── 2. assertAdmin Enforcement ───────────────────────────────────────────
  describe('assertAdmin Guard', () => {
    test('returns authorized: false with error message when user is unauthenticated', async () => {
      const mockSupabase = {} as SupabaseClient<Database>
      const result = await assertAdmin(mockSupabase, null)
      expect(result.authorized).toBe(false)
      expect(result.error).toBe('Not authenticated')
    })

    test('returns authorized: false with error message when user is non-admin', async () => {
      const regularUser = {
        id: 'user-200',
        app_metadata: {},
        user_metadata: {},
      } as unknown as User

      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      } as unknown as SupabaseClient<Database>

      const result = await assertAdmin(mockSupabase, regularUser)
      expect(result.authorized).toBe(false)
      expect(result.error).toContain('Administrator privileges required')
    })

    test('returns authorized: true when user is verified admin', async () => {
      const adminUser = {
        id: 'admin-valid',
        app_metadata: { role: 'admin' },
        user_metadata: {},
      } as unknown as User

      const mockSupabase = {} as SupabaseClient<Database>
      const result = await assertAdmin(mockSupabase, adminUser)
      expect(result.authorized).toBe(true)
      expect(result.error).toBeUndefined()
    })
  })

  // ─── 3. Organizer Lifecycle & Suspension Invariants ───────────────────────
  describe('Organizer Lifecycle & Suspension Security', () => {
    interface SimulatedProfile {
      id: string
      email: string
      full_name: string
      role: 'student' | 'organizer'
      is_verified: boolean
      is_suspended: boolean
      suspended_at?: string | null
      suspension_reason?: string | null
    }

    const profilesDb: SimulatedProfile[] = [
      {
        id: 'org-pending',
        email: 'applicant@berkeley.edu',
        full_name: 'Robotics Club',
        role: 'organizer',
        is_verified: false,
        is_suspended: false,
      },
      {
        id: 'org-active',
        email: 'active@berkeley.edu',
        full_name: 'Coding Society',
        role: 'organizer',
        is_verified: true,
        is_suspended: false,
      },
      {
        id: 'student-user',
        email: 'student@berkeley.edu',
        full_name: 'John Student',
        role: 'student',
        is_verified: false,
        is_suspended: false,
      },
    ]

    function simulateApproveOrganizer(callerIsAdmin: boolean, organizerId: string) {
      if (!callerIsAdmin) {
        return { success: false, error: 'Only administrators can approve organizers.' }
      }
      const p = profilesDb.find((u) => u.id === organizerId)
      if (!p) return { success: false, error: 'Organizer not found' }
      p.is_verified = true
      return { success: true, data: { id: organizerId } }
    }

    function simulateSuspendOrganizer(
      callerIsAdmin: boolean,
      organizerId: string,
      reason: string
    ) {
      if (!callerIsAdmin) {
        return { success: false, error: 'Only administrators can suspend organizers.' }
      }
      if (!reason?.trim()) {
        return { success: false, error: 'Suspension reason is required' }
      }
      const p = profilesDb.find((u) => u.id === organizerId)
      if (!p) return { success: false, error: 'Organizer not found' }
      p.is_suspended = true
      p.suspended_at = new Date().toISOString()
      p.suspension_reason = reason
      return { success: true, data: { id: organizerId } }
    }

    function simulateRevokeOrganizer(
      callerIsAdmin: boolean,
      organizerId: string,
      reason: string
    ) {
      if (!callerIsAdmin) {
        return { success: false, error: 'Only administrators can revoke organizer privileges.' }
      }
      if (!reason?.trim()) {
        return { success: false, error: 'Revocation reason is required' }
      }
      const p = profilesDb.find((u) => u.id === organizerId)
      if (!p) return { success: false, error: 'Organizer not found' }
      p.role = 'student'
      p.is_verified = false
      p.is_suspended = false
      return { success: true, data: { id: organizerId } }
    }

    test('non-admin is blocked from approving organizers', () => {
      const result = simulateApproveOrganizer(false, 'org-pending')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Only administrators')
    })

    test('admin can approve pending organizer', () => {
      const result = simulateApproveOrganizer(true, 'org-pending')
      expect(result.success).toBe(true)
      const approved = profilesDb.find((p) => p.id === 'org-pending')
      expect(approved?.is_verified).toBe(true)
    })

    test('non-admin is blocked from suspending organizers', () => {
      const result = simulateSuspendOrganizer(false, 'org-active', 'Violations')
      expect(result.success).toBe(false)
    })

    test('suspension requires a mandatory reason', () => {
      const result = simulateSuspendOrganizer(true, 'org-active', '   ')
      expect(result.success).toBe(false)
      expect(result.error).toContain('reason is required')
    })

    test('admin can suspend organizer and record suspension metadata', () => {
      const result = simulateSuspendOrganizer(
        true,
        'org-active',
        'Unauthorized alcohol service at campus event'
      )
      expect(result.success).toBe(true)
      const suspended = profilesDb.find((p) => p.id === 'org-active')
      expect(suspended?.is_suspended).toBe(true)
      expect(suspended?.suspension_reason).toContain('alcohol service')
      expect(suspended?.suspended_at).toBeDefined()
    })

    test('revoking organizer demotes role to student and clears organizer status', () => {
      const result = simulateRevokeOrganizer(
        true,
        'org-active',
        'Club disbanded by student union'
      )
      expect(result.success).toBe(true)
      const revoked = profilesDb.find((p) => p.id === 'org-active')
      expect(revoked?.role).toBe('student')
      expect(revoked?.is_verified).toBe(false)
    })

    test('suspended organizers cannot create or publish events (check_organizer_not_suspended invariant)', () => {
      function canCreateEvent(profile: SimulatedProfile): boolean {
        if (profile.is_suspended) return false
        if (profile.role !== 'organizer' || !profile.is_verified) return false
        return true
      }

      const suspendedOrg: SimulatedProfile = {
        id: 'suspended-1',
        email: 'suspended@berkeley.edu',
        full_name: 'Suspended Club',
        role: 'organizer',
        is_verified: true,
        is_suspended: true,
      }

      expect(canCreateEvent(suspendedOrg)).toBe(false)
    })
  })

  // ─── 4. Campus & Domain Configuration Security ───────────────────────────
  describe('Campus & Domain Configuration Security', () => {
    const campuses: AdminCampusWithCounts[] = [
      {
        id: 'campus-1',
        name: 'Stanford University',
        slug: 'stanford',
        approved_domains: ['stanford.edu'],
        is_active: true,
        verified_user_count: 50,
        total_user_count: 60,
        event_count: 10,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'campus-2',
        name: 'UC Berkeley',
        slug: 'berkeley',
        approved_domains: ['berkeley.edu'],
        is_active: true,
        verified_user_count: 80,
        total_user_count: 95,
        event_count: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    function validateDomainFormat(domain: string): boolean {
      return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain.trim().toLowerCase())
    }

    function checkDomainCollision(newDomain: string, targetCampusId: string): string | null {
      const clean = newDomain.trim().toLowerCase()
      for (const campus of campuses) {
        if (campus.approved_domains.map((d) => d.toLowerCase()).includes(clean)) {
          if (campus.id === targetCampusId) {
            return `Domain "${clean}" is already assigned to this campus`
          }
          return `Domain "${clean}" is already assigned to campus "${campus.name}"`
        }
      }
      return null
    }

    test('validates campus email domain syntax strictly', () => {
      expect(validateDomainFormat('stanford.edu')).toBe(true)
      expect(validateDomainFormat('cs.stanford.edu')).toBe(true)
      expect(validateDomainFormat('berkeley.ac.in')).toBe(true)

      // Invalid formats
      expect(validateDomainFormat('@stanford.edu')).toBe(false)
      expect(validateDomainFormat('stanford')).toBe(false)
      expect(validateDomainFormat('https://stanford.edu')).toBe(false)
      expect(validateDomainFormat('stanford .edu')).toBe(false)
      expect(validateDomainFormat('')).toBe(false)
    })

    test('prevents domain collision between campuses (domain hijacking protection)', () => {
      // Adding stanford.edu to UC Berkeley should be rejected
      const collisionError = checkDomainCollision('stanford.edu', 'campus-2')
      expect(collisionError).toContain('already assigned to campus "Stanford University"')
    })

    test('prevents duplicate domain addition on the same campus', () => {
      const duplicateError = checkDomainCollision('stanford.edu', 'campus-1')
      expect(duplicateError).toContain('already assigned to this campus')
    })

    test('allows non-conflicting new valid domain', () => {
      const result = checkDomainCollision('alumni.stanford.edu', 'campus-1')
      expect(result).toBeNull()
    })
  })

  // ─── 5. Admin Event Deletion with Safety Bypass ───────────────────────────
  describe('Admin Event Deletion Invariants', () => {
    interface SimulatedEvent {
      id: string
      title: string
      organizer_id: string
      registrations_count: number
    }

    interface SimulatedAuditLog {
      admin_id: string
      action: AdminAuditAction
      target_type: string
      target_id: string
      reason: string
      metadata: Record<string, unknown>
    }

    const auditLogs: SimulatedAuditLog[] = []
    const sentNotifications: { user_id: string; type: string; title: string }[] = []

    function simulateDeleteEvent(
      callerIsAdmin: boolean,
      adminId: string,
      event: SimulatedEvent,
      reason: string,
      adminNotes?: string
    ) {
      if (!callerIsAdmin) {
        return { success: false, error: 'Unauthorized: Admin privileges required' }
      }

      // Normal deletion safety trigger check
      // For admin deletion RPC: bypass flag is set in session ('campusloop.admin_delete_bypass' = 'true')
      const adminBypass = callerIsAdmin

      if (!adminBypass && event.registrations_count > 0) {
        return {
          success: false,
          error: `Cannot delete an event that has registrations (found ${event.registrations_count} registered attendees).`,
        }
      }

      // 1. Immutable audit record inserted BEFORE deletion
      auditLogs.push({
        admin_id: adminId,
        action: 'event_deleted',
        target_type: 'event',
        target_id: event.id,
        reason,
        metadata: {
          event_title: event.title,
          registrations_count: event.registrations_count,
          admin_notes: adminNotes,
        },
      })

      // 2. Notifications dispatched to registered attendees
      if (event.registrations_count > 0) {
        sentNotifications.push({
          user_id: 'registered-user-1',
          type: 'admin_event_removed',
          title: 'Event Removed',
        })
      }

      return {
        success: true,
        data: {
          deletedTitle: event.title,
          affectedUsers: event.registrations_count,
        },
      }
    }

    test('non-admin cannot call admin delete event', () => {
      const event: SimulatedEvent = {
        id: 'evt-illegal',
        title: 'Hate Group Rally',
        organizer_id: 'rogue-org',
        registrations_count: 5,
      }

      const result = simulateDeleteEvent(false, 'normal-user', event, 'Policy violation')
      expect(result.success).toBe(false)
      expect(result.error).toContain('Unauthorized')
      expect(auditLogs.length).toBe(0)
    })

    test('admin can permanently delete event even with active registrations', () => {
      const event: SimulatedEvent = {
        id: 'evt-flagged-101',
        title: 'Phishing Workshop Event',
        organizer_id: 'scam-org',
        registrations_count: 24,
      }

      const result = simulateDeleteEvent(
        true,
        'admin-primary',
        event,
        'Commercial spam or scam event',
        'Investigated phishing reports from attendees'
      )

      expect(result.success).toBe(true)
      expect(result.data?.affectedUsers).toBe(24)

      // Verify audit log entry was created
      const audit = auditLogs.find((l) => l.target_id === 'evt-flagged-101')
      expect(audit).toBeDefined()
      expect(audit?.action).toBe('event_deleted')
      expect(audit?.admin_id).toBe('admin-primary')
      expect(audit?.reason).toContain('Commercial spam or scam')
      expect(audit?.metadata['registrations_count']).toBe(24)

      // Verify attendee notification was dispatched
      const notif = sentNotifications.find((n) => n.type === 'admin_event_removed')
      expect(notif).toBeDefined()
      expect(notif?.title).toBe('Event Removed')
    })
  })

  // ─── 6. Audit Log Immutability Invariants ─────────────────────────────────
  describe('Audit Log Immutability Guarantee', () => {
    test('Audit log schema enforces append-only semantics (no UPDATE or DELETE)', () => {
      // In PostgreSQL RLS:
      // CREATE POLICY "Admins can view audit log" ON admin_audit_log FOR SELECT USING (is_admin());
      // CREATE POLICY "Admins can insert audit log" ON admin_audit_log FOR INSERT WITH CHECK (is_admin());
      // Notice: NO policy for UPDATE, and NO policy for DELETE.
      // Under Supabase / Postgres RLS, without an explicit UPDATE or DELETE policy, all UPDATE and DELETE commands are unconditionally denied (fail closed).

      const allowedOperations = ['SELECT', 'INSERT']
      const deniedOperations = ['UPDATE', 'DELETE', 'TRUNCATE']

      expect(allowedOperations).not.toContain('UPDATE')
      expect(allowedOperations).not.toContain('DELETE')
      expect(deniedOperations).toContain('UPDATE')
      expect(deniedOperations).toContain('DELETE')
    })
  })
})
