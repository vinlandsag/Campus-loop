import type { EventTeamRole } from '@/types'

// ─── Pure Permission Predicates (Safe for Client & Server) ──────────────────────

export function canEditEvent(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageTeam(role: EventTeamRole | null): boolean {
  return role === 'owner'
}

export function canManageQuestions(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canSendAnnouncements(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canCheckIn(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor' || role === 'check_in_staff'
}

export function canViewParticipants(role: EventTeamRole | null): boolean {
  return role !== null
}

export function canExportCSV(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor' || role === 'viewer'
}

export function canViewRegistrationAnswers(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor' || role === 'viewer'
}

export function canViewAnalytics(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor' || role === 'viewer'
}

export function canDeleteEvent(role: EventTeamRole | null): boolean {
  return role === 'owner'
}

export function canCancelEvent(role: EventTeamRole | null): boolean {
  return role === 'owner'
}

export function canManageCertificates(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageVolunteers(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canCheckInVolunteers(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor' || role === 'check_in_staff'
}

export function canManageGallery(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageTranslations(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageIntegrations(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}

export function canManageEvent(role: EventTeamRole | null): boolean {
  return role === 'owner' || role === 'editor'
}
