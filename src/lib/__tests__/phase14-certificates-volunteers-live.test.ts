import { describe, it, expect } from 'vitest'
import {
  generateCertificateCode,
  generateCertificateHash,
  verifyCertificateHash,
  formatPublicRecipientName,
} from '@/lib/certificates/verification'
import {
  canManageCertificates,
  canManageVolunteers,
  canCheckInVolunteers,
  canManageGallery,
  canManageEvent,
} from '@/lib/auth/permissions'
import type { EventTeamRole } from '@/types'

describe('Phase 14: Post-Registration Value, Live Events, Certificates, Volunteers & Gallery', () => {
  describe('Cryptographic Certificate Integrity & Tamper-Resistance', () => {
    it('generates a formatted, unique verification code matching standard pattern', () => {
      const code1 = generateCertificateCode('HACK')
      const code2 = generateCertificateCode('HACK')

      expect(code1).toMatch(/^CL-CERT-HACK-[A-Z0-9]{8}$/)
      expect(code2).toMatch(/^CL-CERT-HACK-[A-Z0-9]{8}$/)
      expect(code1).not.toBe(code2)
    })

    it('generates a verifiable cryptographic HMAC hash', () => {
      const payload = {
        certificateCode: 'CL-CERT-HACK-F8A2B9C1',
        eventId: 'event-uuid-1',
        userId: 'user-uuid-1',
        issuedAt: '2026-09-12T12:00:00.000Z',
      }

      const hash = generateCertificateHash(payload)
      expect(hash).toBeDefined()
      expect(hash.length).toBe(64) // SHA-256 hex string

      // Verifies with same payload
      const isValid = verifyCertificateHash(payload, hash)
      expect(isValid).toBe(true)

      // Fails if payload was tampered with
      const tampered = verifyCertificateHash(
        { ...payload, userId: 'attacker-uuid-9' },
        hash
      )
      expect(tampered).toBe(false)
    })

    it('preserves student privacy on public verification page by redacting full name', () => {
      expect(formatPublicRecipientName('Johnathan Doe')).toBe('Johnathan D.')
      expect(formatPublicRecipientName('Alice Smith')).toBe('Alice S.')
      expect(formatPublicRecipientName('Aristotle')).toBe('Aristotle')
      expect(formatPublicRecipientName(null)).toBe('Verified Campus Student')
      expect(formatPublicRecipientName('')).toBe('Verified Campus Student')
    })
  })

  describe('Certificate Eligibility & Role Permissions', () => {
    it('restricts certificate and gallery management to event owners and editors', () => {
      const ownerRole: EventTeamRole = 'owner'
      const editorRole: EventTeamRole = 'editor'
      const staffRole: EventTeamRole = 'check_in_staff'
      const viewerRole: EventTeamRole = 'viewer'

      expect(canManageCertificates(ownerRole)).toBe(true)
      expect(canManageCertificates(editorRole)).toBe(true)
      expect(canManageCertificates(staffRole)).toBe(false)
      expect(canManageCertificates(viewerRole)).toBe(false)
      expect(canManageCertificates(null)).toBe(false)

      expect(canManageGallery(ownerRole)).toBe(true)
      expect(canManageGallery(editorRole)).toBe(true)
      expect(canManageGallery(staffRole)).toBe(false)
      expect(canManageGallery(null)).toBe(false)
    })

    it('allows check_in_staff to check in volunteers but not manage/create volunteer roles', () => {
      const ownerRole: EventTeamRole = 'owner'
      const editorRole: EventTeamRole = 'editor'
      const staffRole: EventTeamRole = 'check_in_staff'
      const volunteerUser: EventTeamRole | null = null

      expect(canManageVolunteers(ownerRole)).toBe(true)
      expect(canManageVolunteers(editorRole)).toBe(true)
      expect(canManageVolunteers(staffRole)).toBe(false)
      expect(canManageVolunteers(volunteerUser)).toBe(false)

      expect(canCheckInVolunteers(ownerRole)).toBe(true)
      expect(canCheckInVolunteers(editorRole)).toBe(true)
      expect(canCheckInVolunteers(staffRole)).toBe(true)
      expect(canCheckInVolunteers(volunteerUser)).toBe(false)

      // Strict Privilege Isolation: volunteers never receive event management permissions
      expect(canManageEvent(volunteerUser)).toBe(false)
    })
  })

  describe('Volunteer Role Capacity & Shift Scheduling', () => {
    it('accurately calculates available volunteer spots based on approved signups', () => {
      const roleCapacity = 5
      const signups = [
        { id: '1', status: 'approved' },
        { id: '2', status: 'checked_in' },
        { id: '3', status: 'pending' },
        { id: '4', status: 'declined' },
      ]

      // Only approved and checked_in occupy official capacity
      const confirmedVolunteers = signups.filter(
        (s) => s.status === 'approved' || s.status === 'checked_in'
      ).length

      const availableSpots = Math.max(0, roleCapacity - confirmedVolunteers)
      expect(confirmedVolunteers).toBe(2)
      expect(availableSpots).toBe(3)
    })
  })

  describe('Live Announcements Priority & Categorization', () => {
    it('orders pinned live announcements ahead of unpinned chronological announcements', () => {
      const announcements = [
        { id: '1', title: 'Welcome attendees', is_pinned: false, created_at: '2026-09-12T10:00:00Z' },
        { id: '2', title: 'Venue moved to Room 402', is_pinned: true, created_at: '2026-09-12T09:00:00Z' },
        { id: '3', title: 'Lunch is served', is_pinned: false, created_at: '2026-09-12T12:00:00Z' },
      ]

      const sorted = [...announcements].sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) {
          return a.is_pinned ? -1 : 1
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })

      expect(sorted[0]?.id).toBe('2') // Pinned venue notice first
      expect(sorted[0]?.title).toBe('Venue moved to Room 402')
      expect(sorted[1]?.id).toBe('3') // Later unpinned notice
      expect(sorted[2]?.id).toBe('1') // Earlier unpinned notice
    })
  })
})
