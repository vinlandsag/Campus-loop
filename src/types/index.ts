import type { EventCategory, UserRole } from '@/lib/constants'
export type { EventCategory, UserRole }

// ─── Campus ────────────────────────────────────────────────────────────────────

export interface Campus {
  id: string
  name: string
  slug: string
  approved_domains: string[]
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export type CampusVerificationStatus = 'unverified' | 'pending' | 'verified' | 'exception'

// ─── Profile ───────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  role: UserRole
  display_name: string
  full_name?: string
  avatar_url: string | null
  is_verified: boolean
  campus_id?: string | null
  campus_verification_status?: CampusVerificationStatus
  campus_exception_reason?: string | null
  campus_verified_at?: string | null
  pending_campus_id?: string | null
  campus?: Campus | null
  bio?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  contact_email?: string | null
  college?: string | null
  department?: string | null
  year?: string | null
  preferred_name?: string | null
  public_fields_visibility?: PublicFieldsVisibility | null
  two_factor_enabled?: boolean
  deletion_requested_at?: string | null
  created_at: string
  updated_at: string
}

export interface OrganizerProfile {
  id: string
  full_name: string
  avatar_url: string | null
  is_verified: boolean
  campus_id?: string | null
  campus?: Campus | null
  bio?: string | null
  website_url?: string | null
  instagram_handle?: string | null
  contact_email?: string | null
  college?: string | null
  department?: string | null
  created_at?: string | null
}

// ─── Event ─────────────────────────────────────────────────────────────────────

export interface EventAgendaItem {
  time: string
  title: string
  description?: string
}

export interface EventSpeaker {
  name: string
  role?: string
  bio?: string
  avatar_url?: string
}

export interface Event {
  id: string
  organizer_id: string
  title: string
  slug: string
  description: string
  location: string
  event_date?: string
  start_time?: string
  end_time?: string
  starts_at: string
  ends_at: string
  cover_image: string | null
  category: EventCategory
  capacity: number | null
  is_published: boolean
  tags: string[]
  timezone?: string
  active_registrations_count?: number
  campus_id?: string | null
  campus?: Pick<Campus, 'id' | 'name' | 'slug'> | null
  created_at: string
  updated_at: string
  /** Joined from profiles / organizer_profiles */
  organizer?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'is_verified'>
  /** Computed — count of registrations */
  registration_count?: number
  status?: 'draft' | 'published' | 'cancelled' | 'completed'
  cancellation_reason?: string | null
  change_notice?: string | null
  rescheduled_at?: string | null
  /** Student Decision & Logistics (Phase 7) */
  agenda?: EventAgendaItem[] | null
  speakers?: EventSpeaker[] | null
  eligibility?: string | null
  registration_deadline?: string | null
  what_to_bring?: string | null
  contact_method?: string | null
  accessibility_notes?: string | null
  map_url?: string | null
  /** Recurring Series & Team Registration (Phase 13) */
  series_id?: string | null
  series_sequence_index?: number | null
  is_series_override?: boolean
  registration_mode?: 'individual' | 'team' | 'both'
  min_team_size?: number | null
  max_team_size?: number | null
  max_teams?: number | null
  /** Structured Venues & Phase 15 */
  venue_id?: string | null
  venue?: CampusVenue | null
  building?: string | null
  floor?: string | null
  room?: string | null
  latitude?: number | null
  longitude?: number | null
  accessibility_details?: string | null
  directions_url?: string | null
  reschedule_count?: number
}

// ─── Notification ──────────────────────────────────────────────────────────────

export type NotificationType =
  | 'registration_confirmed'
  | 'event_cancelled'
  | 'event_rescheduled'
  | 'venue_changed'
  | 'reminder'
  | 'reminder_24h'
  | 'reminder_1h'
  | 'waitlist_promoted'
  | 'checked_in'
  | 'announcement'

export type EmailDeliveryStatus =
  | 'pending'
  | 'sent'
  | 'skipped_no_provider'
  | 'failed'
  | 'opted_out'

export interface InAppNotification {
  id: string
  user_id: string
  event_id: string | null
  type: NotificationType
  title: string
  message: string
  link: string | null
  is_read: boolean
  email_status?: EmailDeliveryStatus
  email_recipient?: string | null
  email_provider?: string | null
  email_sent_at?: string | null
  email_error?: string | null
  dedup_key?: string | null
  created_at: string
  event?: Pick<Event, 'id' | 'title' | 'slug' | 'status'> | null
}

// ─── Organizer Teams ────────────────────────────────────────────────────────────

export type EventTeamRole = 'owner' | 'editor' | 'check_in_staff' | 'viewer'

export interface EventTeamMember {
  id: string
  event_id: string
  user_id: string
  role: EventTeamRole
  invited_by?: string | null
  created_at: string
  updated_at?: string
  user?: {
    display_name?: string | null
    email?: string | null
    avatar_url?: string | null
  }
}

// ─── Registration Questions & Answers ──────────────────────────────────────────

export type QuestionType = 'text' | 'select' | 'checkbox' | 'textarea'

export interface RegistrationQuestion {
  id: string
  event_id: string
  question_text: string
  question_type: QuestionType
  options?: string[] | null
  is_required: boolean
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface RegistrationAnswer {
  id: string
  registration_id: string
  question_id: string
  answer_text: string
  created_at?: string
  question?: RegistrationQuestion
}

// ─── Event Announcements ───────────────────────────────────────────────────────

export type AnnouncementTargetFilter = 'all' | 'registered' | 'checked_in' | 'waitlisted'

export interface EventAnnouncement {
  id: string
  event_id: string
  sent_by?: string | null
  title: string
  message: string
  target_filter: AnnouncementTargetFilter
  recipient_count: number
  is_pinned?: boolean
  category?: AnnouncementCategory
  created_at: string
  sender?: {
    display_name?: string | null
  }
}

// ─── Organizer Metrics ─────────────────────────────────────────────────────────

export interface EventMetricsData {
  registrationsOverTime: Array<{
    date: string
    count: number
    cumulative: number
  }>
  attendanceRate: number
  registeredCount: number
  checkedInCount: number
  noShowsCount: number
  waitlistCount: number
  waitlistConversionsCount: number
  capacity: number | null
  capacityProgress: number
}

// ─── Registration & Attendance ──────────────────────────────────────────────────

export type RegistrationStatus = 'registered' | 'waitlisted' | 'checked_in' | 'cancelled'

export interface Registration {
  id: string
  event_id: string
  student_id: string
  registered_at: string
  status?: RegistrationStatus
  ticket_code?: string | null
  checked_in_at?: string | null
  checked_in_by?: string | null
  waitlist_position?: number | null
  /** Joined */
  event?: Event
  /** Joined */
  student?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>
  answers?: RegistrationAnswer[]
}

export interface TicketData {
  ticketCode: string
  eventId: string
  eventSlug: string
  eventTitle: string
  eventStartsAt: string
  eventEndsAt?: string
  eventLocation: string
  campusName?: string | null
  studentId: string
  attendeeName: string
  registrationId: string
  status: RegistrationStatus
  checkedInAt?: string | null
  attendanceVisibility?: AttendanceVisibility
  qrDataUrl?: string
  qrSvg?: string
}

export interface CheckInResult {
  success: boolean
  alreadyCheckedIn?: boolean
  checkedInAt?: string
  attendeeName?: string
  ticketCode?: string
  eventTitle?: string
  error?: string
}

export interface AttendanceStats {
  registeredCount: number
  waitlistCount: number
  checkedInCount: number
  capacity: number | null
  attendanceRate: number
}

// ─── Favourite ─────────────────────────────────────────────────────────────────

export interface Favourite {
  id: string
  event_id: string
  student_id: string
  created_at: string
  event?: Event
}

// ─── Pagination ────────────────────────────────────────────────────────────────

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  perPage: number
  hasNextPage: boolean
}

export interface CursorPage<T> {
  data: T[]
  nextCursor: string | null
}

// ─── UI / Form ─────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string
  label: string
}

export type ActionResult<T = void> =
  | ([T] extends [void]
      ? { success: true; data?: void }
      : { success: true; data: T })
  | { success: false; error: string }

// ─── Phase 10: Post-Registration, Notifications, Feedback & Moderation ──────

export interface UserNotificationPreferences {
  user_id: string
  reminder_24h: boolean
  reminder_1h: boolean
  event_updates: boolean
  waitlist_promotions: boolean
  marketing_announcements: boolean
  email_enabled: boolean
  in_app_enabled?: boolean
  registration_confirmations_email?: boolean
  registration_confirmations_in_app?: boolean
  reminders_24h_in_app?: boolean
  reminders_1h_in_app?: boolean
  event_updates_in_app?: boolean
  waitlist_promotions_in_app?: boolean
  followed_clubs_email?: boolean
  followed_clubs_in_app?: boolean
  friend_activity_email?: boolean
  friend_activity_in_app?: boolean
  quiet_hours_enabled?: boolean
  quiet_hours_start?: string
  quiet_hours_end?: string
  delivery_timezone?: string
  updated_at?: string
}

export type FeedbackIssueCategory =
  | 'venue'
  | 'organization'
  | 'safety'
  | 'audio_visual'
  | 'scheduling'
  | 'other'

export interface EventFeedback {
  id: string
  event_id: string
  user_id: string
  rating: number
  feedback?: string | null
  has_issue: boolean
  issue_category?: FeedbackIssueCategory | null
  issue_description?: string | null
  created_at: string
  updated_at: string
}

export interface AnonymousFeedbackItem {
  rating: number
  feedback: string | null
  has_issue?: boolean
  issue_category?: string | null
  created_at: string
}

export interface EventFeedbackSummary {
  average_rating: number
  total_reviews: number
  distribution: Record<string, number>
  recent_comments: AnonymousFeedbackItem[]
  issues_count: number
  issues_by_category: Record<string, number>
}

export type ModerationTargetType = 'event' | 'organizer' | 'photo' | 'networking_profile'

export type ModerationReportReason =
  | 'spam'
  | 'misleading'
  | 'safety_concern'
  | 'fraud'
  | 'inappropriate'
  | 'harassment'
  | 'other'

export type ModerationReportStatus =
  | 'pending'
  | 'investigating'
  | 'action_taken'
  | 'dismissed'

export interface ModerationReport {
  id: string
  reporter_id: string
  target_type: ModerationTargetType
  target_id: string
  reason: ModerationReportReason
  details?: string | null
  status: ModerationReportStatus
  admin_notes?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
  created_at: string
}

// ─── Offline Check-In Types ───────────────────────────────────────────────────

export interface OfflineRosterAttendee {
  registrationId: string
  ticketCode: string
  attendeeName: string
  status: string
  checkedInAt?: string | null
}

export interface OfflineCheckInRoster {
  eventId: string
  eventTitle: string
  cachedAt: string
  expiresAt: string
  version?: number
  attendees: OfflineRosterAttendee[]
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset_at: string
  retry_after_seconds?: number
}

export interface NotificationWorkerRunResult {
  success: boolean
  processedCount: number
  completedCount: number
  failedCount: number
  skippedCount: number
  errors: Array<{ jobId: string; error: string }>
}

export interface QueuedOfflineScan {
  scanId: string
  ticketCode: string
  scannedAt: string
  attendeeName?: string
}

export interface OfflineSyncResult {
  scanId: string
  ticketCode: string
  success: boolean
  alreadyCheckedIn?: boolean
  attendeeName?: string
  error?: string
}

export type AttendanceVisibility = 'private' | 'friends' | 'public'

export interface ClubFollow {
  id: string
  user_id: string
  organizer_id: string
  notify_on_new_events: boolean
  created_at: string
}

export interface ClubFollowDetails {
  id: string
  organizer_id: string
  organizer_name: string
  avatar_url?: string | null
  notify_on_new_events: boolean
  follower_count?: number
  created_at: string
}

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

export interface Friendship {
  id: string
  user_id: string
  friend_id: string
  status: FriendshipStatus
  created_at: string
  updated_at: string
}

export interface FriendDetails {
  friendship_id: string
  friend_user_id: string
  full_name: string
  display_name?: string | null
  avatar_url?: string | null
  campus_name?: string | null
  status: FriendshipStatus
  is_requester: boolean
  since: string
}

export interface UserSocialPreferences {
  user_id: string
  share_attendance_with_friends: boolean
  default_attendance_visibility: AttendanceVisibility
  allow_friend_requests: boolean
  created_at?: string
  updated_at?: string
}

export interface ConsentedFriendAttendance {
  count: number
  friends: Array<{ id: string; name: string; avatar_url?: string | null }>
}

export type EventRecommendationReason =
  | 'campus_match'
  | 'followed_club'
  | 'friends_attending'
  | 'category_interest'
  | 'happening_soon'
  | 'campus_popular'

export interface RecommendationExplanation {
  score: number
  reasons: string[]
  tags: EventRecommendationReason[]
}

// ─── Recurring Events & Event Series (Phase 13) ─────────────────────────────────

export type RecurrenceType = 'weekly' | 'monthly' | 'custom'
export type RecurrenceEndType = 'date' | 'count'

export interface EventSeries {
  id: string
  organizer_id: string
  campus_id?: string | null
  title: string
  slug: string
  description?: string | null
  recurrence_type: RecurrenceType
  interval_value: number
  days_of_week?: number[] | null
  end_type: RecurrenceEndType
  end_date?: string | null
  occurrence_count?: number | null
  created_at: string
  updated_at: string
  campus?: Pick<Campus, 'id' | 'name' | 'slug'> | null
  organizer?: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'is_verified'>
  occurrences?: Event[]
}

// ─── Group & Team Registration (Phase 13) ───────────────────────────────────────

export type RegistrationMode = 'individual' | 'team' | 'both'
export type TeamStatus = 'forming' | 'complete' | 'disbanded'
export type TeamMemberRole = 'leader' | 'member'
export type TeamMemberStatus = 'pending' | 'confirmed'

export interface EventRegistrationTeamMember {
  id: string
  team_id: string
  user_id: string
  event_id: string
  registration_id?: string | null
  role: TeamMemberRole
  status: TeamMemberStatus
  joined_at: string
  user?: {
    id: string
    display_name: string
    full_name?: string
    avatar_url?: string | null
  }
}

export interface EventRegistrationTeam {
  id: string
  event_id: string
  name: string
  leader_id: string
  invite_code: string
  status: TeamStatus
  created_at: string
  updated_at: string
  members?: EventRegistrationTeamMember[]
  member_count?: number
  leader?: {
    id: string
    display_name: string
    avatar_url?: string | null
  }
}

// ─── Post-Registration & Live Events (Phase 14) ────────────────────────────────

export type CertificateEligibility = 'checked_in' | 'registered' | 'manual'
export type CertificateStatus = 'valid' | 'revoked'

export interface EventCertificateConfig {
  id: string
  event_id: string
  is_enabled: boolean
  eligibility: CertificateEligibility
  title: string
  title_template?: string | null
  description?: string | null
  issuer_name?: string | null
  issuer_title?: string | null
  signatory_title?: string | null
  custom_message?: string | null
  created_at: string
  updated_at: string
}

export interface EventCertificate {
  id: string
  event_id: string
  user_id: string
  certificate_code: string
  verification_hash: string
  recipient_name: string
  status: CertificateStatus
  issued_at: string
  revoked_at?: string | null
  revocation_reason?: string | null
  event?: Pick<Event, 'id' | 'title' | 'event_date' | 'slug'>
  config?: EventCertificateConfig | null
}

export interface PublicCertificateVerification {
  is_valid: boolean
  certificate_code: string
  recipient_name: string
  event_title: string
  event_date: string
  issuer_name: string
  certificate_title: string
  status: string
  issued_at: string
}

export interface EventVolunteerRole {
  id: string
  event_id: string
  title: string
  description?: string | null
  required_skills?: string | null
  shift_start?: string | null
  shift_end?: string | null
  capacity: number
  created_at: string
  signup_count?: number
  available_spots?: number
}

export type VolunteerSignupStatus =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'checked_in'
  | 'cancelled'

export interface EventVolunteerSignup {
  id: string
  role_id: string
  event_id: string
  user_id: string
  status: VolunteerSignupStatus
  notes?: string | null
  checked_in_at?: string | null
  created_at: string
  updated_at: string
  role?: EventVolunteerRole
  event?: {
    id: string
    title: string
    slug: string
    event_date: string
    start_time: string
    location: string
  }
  user?: {
    id: string
    full_name: string
    email: string
    avatar_url?: string | null
  }
}

export type AnnouncementCategory =
  | 'general'
  | 'venue_change'
  | 'schedule'
  | 'session_start'
  | 'emergency'
  | 'food'

export interface EventPhoto {
  id: string
  event_id: string
  uploaded_by: string
  photo_url: string
  caption?: string | null
  photographer_credit?: string | null
  created_at: string
  uploader?: {
    id: string
    full_name: string
    avatar_url?: string | null
  }
}

export interface PhotoPrivacyPreference {
  id: string
  user_id: string
  opt_out_photo_appearances: boolean
  created_at: string
  updated_at: string
}

// ─── Phase 15: Structured Venues, Networking, Translations & Integrations ────

export interface CampusVenue {
  id: string
  campus_id: string
  name: string
  building?: string | null
  floor?: string | null
  room?: string | null
  latitude?: number | null
  longitude?: number | null
  accessibility_details?: string | null
  directions_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserNetworkingCard {
  user_id: string
  full_name: string
  course_or_major?: string | null
  headline?: string | null
  interests: string[]
  linkedin_url?: string | null
  portfolio_url?: string | null
  github_url?: string | null
  created_at: string
  updated_at: string
}

export interface EventNetworkingAttendee {
  event_id: string
  user_id: string
  is_opted_in: boolean
  exchange_token: string
  created_at: string
}

export type ContactExchangeStatus = 'pending' | 'accepted' | 'declined' | 'blocked'

export interface ContactExchangeRequest {
  id: string
  event_id: string
  requester_id: string
  recipient_id: string
  status: ContactExchangeStatus
  created_at: string
  updated_at: string
  requester_card?: UserNetworkingCard | null
  recipient_card?: UserNetworkingCard | null
}

export interface EventTranslation {
  id: string
  event_id: string
  language_code: string
  language_name: string
  title: string
  description: string
  details?: {
    what_to_bring?: string | null
    eligibility?: string | null
    change_notice?: string | null
  } | null
  is_machine_translated: boolean
  created_at: string
  updated_at: string
}

export interface EventWebhookIntegration {
  id: string
  event_id: string
  platform: 'discord' | 'slack' | 'generic'
  webhook_url: string
  is_enabled: boolean
  notify_on_announcement: boolean
  notify_on_reschedule: boolean
  created_at: string
  updated_at: string
}

export interface CampusApiKey {
  id: string
  campus_id: string
  partner_name: string
  key_prefix: string
  rate_limit_per_minute: number
  is_active: boolean
  last_used_at?: string | null
  created_at: string
}

export interface PublicEventFeedItem {
  id: string
  title: string
  slug: string
  description: string
  category: string
  starts_at: string
  ends_at: string
  location: string
  building?: string | null
  room?: string | null
  latitude?: number | null
  longitude?: number | null
  accessibility_details?: string | null
  directions_url?: string | null
  cover_image?: string | null
  url: string
  organizer: {
    display_name: string
    is_verified?: boolean
  }
}

// ─── Phase 16: Customer-Grade Settings & Account Center ─────────────────────

export interface PublicFieldsVisibility {
  bio: boolean
  website: boolean
  instagram: boolean
  contact_email: boolean
  college: boolean
  department: boolean
}

export type SecurityAuditAction =
  | 'campus_change_requested'
  | 'privacy_updated'
  | 'password_changed'
  | 'session_revoked'
  | 'account_deletion_requested'
  | 'account_deletion_cancelled'
  | 'organizer_profile_updated'
  | 'organizer_workspace_updated'
  | 'two_factor_toggled'
  | 'user_unblocked'

export interface SecurityAuditLog {
  id: string
  user_id: string
  action: SecurityAuditAction | string
  details: Record<string, unknown>
  ip_address?: string | null
  user_agent?: string | null
  created_at: string
}

export interface AccountDeletionRequest {
  id: string
  user_id: string
  status: 'scheduled' | 'cancelled' | 'completed'
  scheduled_for: string
  reason?: string | null
  created_at: string
  cancelled_at?: string | null
}

export interface OrganizerWorkspaceSettings {
  id: string
  organizer_id: string
  default_timezone: string
  default_venue_id?: string | null
  default_category: string
  default_accessibility_statement?: string | null
  default_contact_email?: string | null
  notify_on_new_registration: boolean
  notify_on_volunteer_application: boolean
  notify_on_event_feedback: boolean
  default_team_invites_enabled: boolean
  created_at: string
  updated_at: string
}

// ─── Phase 17: Admin Control Panel ──────────────────────────────────────────

export type AdminAuditAction =
  | 'organizer_approved'
  | 'organizer_rejected'
  | 'organizer_suspended'
  | 'organizer_unsuspended'
  | 'organizer_revoked'
  | 'event_deleted'
  | 'campus_created'
  | 'campus_updated'
  | 'domain_added'
  | 'domain_removed'
  | 'campus_deactivated'
  | 'campus_exception_approved'
  | 'report_dismissed'
  | 'report_investigated'
  | 'report_action_taken'
  | 'admin_login'
  | 'admin_access_denied'

export interface AdminAuditLogEntry {
  id: string
  admin_id: string
  action: AdminAuditAction | string
  target_type: string
  target_id: string
  reason: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type OrganizerApprovalStatus = 'pending' | 'approved' | 'rejected' | 'suspended' | 'revoked'

export interface AdminOrganizer {
  id: string
  email: string
  full_name: string
  role: string
  is_verified: boolean
  is_suspended: boolean
  campus_id: string | null
  campus_name: string | null
  campus_verification_status: string | null
  college: string | null
  department: string | null
  bio: string | null
  website_url: string | null
  instagram_handle: string | null
  created_at: string
  approval_status: OrganizerApprovalStatus
}

export interface AdminDashboardOverview {
  pendingOrganizers: number
  pendingReports: number
  flaggedEvents: number
  recentAuditCount: number
  totalCampuses: number
  activeCampuses: number
  totalEvents: number
}

export interface AdminEvent {
  id: string
  title: string
  slug: string
  status: string
  category: string
  organizer_id: string
  organizer_name: string
  organizer_verified: boolean
  campus_id: string | null
  campus_name: string | null
  registration_count: number
  capacity: number | null
  event_date: string | null
  start_time: string | null
  end_time: string | null
  created_at: string
}

export interface AdminCampusWithCounts {
  id: string
  name: string
  slug: string
  approved_domains: string[]
  is_active: boolean
  verified_user_count: number
  total_user_count: number
  event_count: number
  created_at: string
  updated_at: string
}

export interface AdminCampusException {
  user_id: string
  full_name: string
  email: string
  current_campus_name: string | null
  pending_campus_name: string | null
  pending_campus_id: string | null
  exception_reason: string | null
  campus_verification_status: string
  created_at: string
}
