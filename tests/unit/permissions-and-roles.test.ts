import { describe, test, expect } from 'vitest'
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
  canDeleteEvent,
  canCancelEvent,
} from '@/lib/auth/permissions'

describe('Unit Tests: Event Team Role Permissions & Data Minimization', () => {
  describe('Event Owner', () => {
    test('owner holds all administrative, operational, and data export privileges', () => {
      expect(canEditEvent('owner')).toBe(true)
      expect(canManageTeam('owner')).toBe(true)
      expect(canManageQuestions('owner')).toBe(true)
      expect(canSendAnnouncements('owner')).toBe(true)
      expect(canCheckIn('owner')).toBe(true)
      expect(canViewParticipants('owner')).toBe(true)
      expect(canExportCSV('owner')).toBe(true)
      expect(canViewRegistrationAnswers('owner')).toBe(true)
      expect(canViewAnalytics('owner')).toBe(true)
      expect(canDeleteEvent('owner')).toBe(true)
      expect(canCancelEvent('owner')).toBe(true)
    })
  })

  describe('Event Editor', () => {
    test('editor can edit event, manage questions, check in, view data, but cannot manage team or cancel/delete event', () => {
      expect(canEditEvent('editor')).toBe(true)
      expect(canManageQuestions('editor')).toBe(true)
      expect(canSendAnnouncements('editor')).toBe(true)
      expect(canCheckIn('editor')).toBe(true)
      expect(canViewParticipants('editor')).toBe(true)
      expect(canExportCSV('editor')).toBe(true)
      expect(canViewRegistrationAnswers('editor')).toBe(true)
      expect(canViewAnalytics('editor')).toBe(true)

      // Strict restrictions
      expect(canManageTeam('editor')).toBe(false)
      expect(canCancelEvent('editor')).toBe(false)
      expect(canDeleteEvent('editor')).toBe(false)
    })
  })

  describe('Check-In Staff (Least Privilege & Data Minimization)', () => {
    test('check_in_staff is authorized to scan tickets and view attendees at door', () => {
      expect(canCheckIn('check_in_staff')).toBe(true)
      expect(canViewParticipants('check_in_staff')).toBe(true)
    })

    test('check_in_staff is strictly denied data export and sensitive question answers', () => {
      expect(canExportCSV('check_in_staff')).toBe(false)
      expect(canViewRegistrationAnswers('check_in_staff')).toBe(false)
      expect(canViewAnalytics('check_in_staff')).toBe(false)
      expect(canEditEvent('check_in_staff')).toBe(false)
      expect(canManageTeam('check_in_staff')).toBe(false)
      expect(canManageQuestions('check_in_staff')).toBe(false)
      expect(canSendAnnouncements('check_in_staff')).toBe(false)
      expect(canCancelEvent('check_in_staff')).toBe(false)
      expect(canDeleteEvent('check_in_staff')).toBe(false)
    })
  })

  describe('Viewer', () => {
    test('viewer has read-only access to attendee data and analytics, but cannot check in attendees', () => {
      expect(canViewParticipants('viewer')).toBe(true)
      expect(canExportCSV('viewer')).toBe(true)
      expect(canViewRegistrationAnswers('viewer')).toBe(true)
      expect(canViewAnalytics('viewer')).toBe(true)

      // Denied mutations
      expect(canCheckIn('viewer')).toBe(false)
      expect(canEditEvent('viewer')).toBe(false)
      expect(canManageTeam('viewer')).toBe(false)
      expect(canManageQuestions('viewer')).toBe(false)
      expect(canSendAnnouncements('viewer')).toBe(false)
      expect(canCancelEvent('viewer')).toBe(false)
      expect(canDeleteEvent('viewer')).toBe(false)
    })
  })

  describe('Unauthenticated / Non-Member', () => {
    test('null role has no permissions', () => {
      expect(canEditEvent(null)).toBe(false)
      expect(canManageTeam(null)).toBe(false)
      expect(canManageQuestions(null)).toBe(false)
      expect(canSendAnnouncements(null)).toBe(false)
      expect(canCheckIn(null)).toBe(false)
      expect(canViewParticipants(null)).toBe(false)
      expect(canExportCSV(null)).toBe(false)
      expect(canViewRegistrationAnswers(null)).toBe(false)
      expect(canViewAnalytics(null)).toBe(false)
      expect(canDeleteEvent(null)).toBe(false)
      expect(canCancelEvent(null)).toBe(false)
    })
  })
})
