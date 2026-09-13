# Implementation Plan: Phase 16 — Customer-Grade Settings & Account Center

Redesign CampusLoop Settings into a responsive, accessible, customer-grade account center where students and organizers can confidently manage their identity, campus affiliation, privacy, notification channels, security, personal data, and organizer defaults.

---

## User Review Required

> [!IMPORTANT]
> **Database Schema Migration (`20260912190000_phase16_account_center_settings.sql`)**:
> - Creates `security_audit_logs` with RLS (users can view their own security logs; system records sensitive actions).
> - Creates `account_deletion_requests` supporting a 14-day grace period with cancellation before permanent purge.
> - Creates `organizer_workspace_settings` for verified organizers to configure default event creation settings (venues, timezones, categories, accessibility statements).
> - Extends `user_notification_preferences` with in-app channels, quiet hours (`quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`), timezone delivery, and followed club / friend activity preferences.
> - Extends `profiles` with `preferred_name`, `public_fields_visibility` (jsonb), `two_factor_enabled`, and `deletion_requested_at`.
> - Updates safe public view `organizer_profiles` to honor `public_fields_visibility` so unselected fields are masked at the database level.

> [!NOTE]
> **Zero Impact on Payments**: Payment processing and Stripe integrations remain untouched, as required.

---

## Proposed Changes

### 1. Database & Schema Layer

#### [NEW] [`supabase/migrations/20260912190000_phase16_account_center_settings.sql`](file:///Users/apple/milan/hub/Eventhub/supabase/migrations/20260912190000_phase16_account_center_settings.sql)
- **`security_audit_logs` table**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `action TEXT NOT NULL` (`campus_change_requested`, `privacy_updated`, `password_changed`, `session_revoked`, `account_deletion_requested`, `account_deletion_cancelled`, `organizer_profile_updated`, `two_factor_toggled`)
  - `details JSONB DEFAULT '{}'::jsonb`
  - `ip_address TEXT`, `user_agent TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - RLS: `SELECT` allowed for `auth.uid() = user_id`.
- **`account_deletion_requests` table**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `status TEXT NOT NULL DEFAULT 'scheduled'` (`scheduled`, `cancelled`, `completed`)
  - `scheduled_for TIMESTAMPTZ NOT NULL` (14 days from request)
  - `reason TEXT`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `cancelled_at TIMESTAMPTZ`
  - RLS: `SELECT` and `UPDATE` allowed for `auth.uid() = user_id`.
- **`organizer_workspace_settings` table**:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `organizer_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE`
  - `default_timezone TEXT NOT NULL DEFAULT 'UTC'`
  - `default_venue_id UUID REFERENCES public.campus_venues(id) ON DELETE SET NULL`
  - `default_category TEXT NOT NULL DEFAULT 'Academic'`
  - `default_accessibility_statement TEXT`
  - `default_contact_email TEXT`
  - `notify_on_new_registration BOOLEAN NOT NULL DEFAULT true`
  - `notify_on_volunteer_application BOOLEAN NOT NULL DEFAULT true`
  - `notify_on_event_feedback BOOLEAN NOT NULL DEFAULT true`
  - `default_team_invites_enabled BOOLEAN NOT NULL DEFAULT true`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - RLS: `auth.uid() = organizer_id` and caller must be an organizer.
- **Extend `user_notification_preferences`**:
  - Columns: `in_app_enabled`, `registration_confirmations_email`, `registration_confirmations_in_app`, `reminders_24h_in_app`, `reminders_1h_in_app`, `event_updates_in_app`, `waitlist_promotions_in_app`, `followed_clubs_email`, `followed_clubs_in_app`, `friend_activity_email`, `friend_activity_in_app`, `quiet_hours_enabled`, `quiet_hours_start`, `quiet_hours_end`, `delivery_timezone`.
- **Extend `profiles`**:
  - Columns: `preferred_name TEXT`, `public_fields_visibility JSONB`, `two_factor_enabled BOOLEAN DEFAULT false`, `deletion_requested_at TIMESTAMPTZ NULL`.
- **Update View `organizer_profiles`**:
  - Dynamically masks fields if omitted in `public_fields_visibility`.

---

### 2. TypeScript Types

#### [MODIFY] [`src/types/index.ts`](file:///Users/apple/milan/hub/Eventhub/src/types/index.ts)
- Add interfaces:
  - `SecurityAuditLog`: id, user_id, action, details, ip_address, created_at.
  - `AccountDeletionRequest`: id, user_id, status, scheduled_for, reason, created_at, cancelled_at.
  - `OrganizerWorkspaceSettings`: id, organizer_id, default_timezone, default_venue_id, default_category, default_accessibility_statement, default_contact_email, notify_on_new_registration, notify_on_volunteer_application, notify_on_event_feedback, default_team_invites_enabled.
  - `PublicFieldsVisibility`: bio, website, instagram, contact_email, college, department (all boolean).
  - Update `UserNotificationPreferences` with in-app, quiet hours, and channel flags.
  - Update `Profile` with `preferred_name`, `public_fields_visibility`, `two_factor_enabled`, `deletion_requested_at`.

---

### 3. Server Actions

#### [NEW] [`src/app/actions/settings.actions.ts`](file:///Users/apple/milan/hub/Eventhub/src/app/actions/settings.actions.ts)
- **Profile actions**:
  - `updateUserProfile(input)`: Validates name, preferred name, bio, academic fields, and public field visibility. Explicitly strips any attempts to alter role, is_verified, or admin fields. Logs audit record if public fields or identity changes.
- **Campus & Eligibility actions**:
  - `checkCampusChangeImpact(targetCampusId: string)`: Inspects user's active event counts, organized events, and team memberships. Warns organizers that events do not transfer across campuses.
  - `requestCampusTransfer(targetCampusId: string, exceptionReason?: string)`: Executes controlled transfer flow from `campus.actions.ts` and logs `campus_change_requested` audit log.
- **Privacy & Social actions**:
  - `updatePrivacyAndSocialSettings(input)`: Updates attendance visibility (private, friends, public), friend request discoverability, and photo opt-out. Logs audit record.
  - `getBlockedUsers()`: Retrieves blocked user records from `networking_blocks`.
  - `unblockUser(blockedUserId: string)`: Removes block record and logs audit record.
- **Security actions**:
  - `changeAccountPassword(currentPassword, newPassword)`: Re-authenticates and updates password via Supabase Auth. Logs audit record.
  - `revokeAllOtherSessions()`: Calls `supabase.auth.signOut({ scope: 'others' })` and logs audit record.
  - `toggleTwoFactor(enabled: boolean)`: Updates 2FA flag and logs audit record.
  - `getSecurityAuditLogs()`: Returns latest 20 security logs for current user.
- **Data & Account actions**:
  - `exportPersonalData()`: Assembles full export payload (profile, registrations, ticket records, certificates, volunteer records, friend list, audit log) for immediate client-side JSON download.
  - `requestAccountDeletion(confirmation: string, reason?: string)`: Validates confirmation string (`"DELETE MY ACCOUNT"`), schedules deletion date for +14 days, records in `account_deletion_requests`, and logs audit record.
  - `cancelAccountDeletion()`: Cancels scheduled deletion and logs audit record.
- **Organizer Workspace actions**:
  - `getOrganizerWorkspaceSettings()`: Fetches verified organizer defaults.
  - `updateOrganizerWorkspaceSettings(input)`: Validates organizer authorization, saves defaults, and logs audit record.
- **Notification actions**:
  - `sendTestNotification(channel: 'in_app' | 'email')`: Dispatches a test notification and email to verify user delivery configuration.

---

### 4. UI Components & Pages

#### [MODIFY] [`src/app/(app)/settings/page.tsx`](file:///Users/apple/milan/hub/Eventhub/src/app/(app)/settings/page.tsx)
- Server component that fetches all current settings data in parallel: profile, campus details, active campuses, campus venues, social/privacy preferences, notification preferences, blocked users, security audit logs, deletion request, and organizer workspace settings (if organizer).
- Suspense wrapper for loading states.
- Passes data to `SettingsClient`.

#### [NEW] [`src/components/settings/SettingsClient.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/SettingsClient.tsx)
- Unified account center client component with 7 addressable tabs:
  1. `?tab=profile` — Profile & Public Profile Preview
  2. `?tab=campus` — Campus & Verification Status
  3. `?tab=notifications` — Notifications & Quiet Hours
  4. `?tab=privacy` — Privacy & Social
  5. `?tab=security` — Security & Session Management
  6. `?tab=data` — Personal Data & Account Deletion
  7. `?tab=organizer` — Organizer Workspace Defaults (Conditional on verified organizer)
- **URL-Addressable**: Reads and sets `?tab=...` via `useSearchParams` and `useRouter` so browser back/forward works seamlessly.
- **Responsive Navigation**: Vertical sidebar with icon pills on desktop/tablet; responsive scrollable pills on mobile.
- **Unsaved Changes Protection**: Alerts user if they attempt to switch tabs or leave while forms have unsaved modifications.
- **Accessibility**: Full keyboard ARIA `role="tablist"`, `role="tab"`, `aria-selected`, `role="tabpanel"`, focus indicators, and screen reader announcements.

#### [NEW] [`src/components/settings/ProfileTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/ProfileTab.tsx)
- Full name, preferred name, avatar upload/URL, bio, college, department, year.
- Live "Public Profile Preview" card showing how attendees and clubs see the profile.
- Individual public field toggles for organizers (bio, website, Instagram, contact email, college, department).
- Non-editable role and verification badge explaining elevation procedures.

#### [NEW] [`src/components/settings/CampusTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/CampusTab.tsx)
- Current campus and verification status badge (`verified`, `unverified`, `pending`, `exception`).
- Informative card explaining why the status is what it is (e.g. email domain match vs pending admin exception).
- Campus change request modal with pre-change impact report: shows organized events that will stay on the current campus and prevents direct cross-campus event transfers.

#### [NEW] [`src/components/settings/NotificationsTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/NotificationsTab.tsx)
- In-app and Email matrix for 8 event communication types.
- Quiet hours toggle with start/end time pickers and timezone selector.
- Mandatory safety override banner: "Critical cancellations, venue shifts, and safety alerts always bypass opt-outs."
- "Send Test Notification" action with feedback toast.

#### [NEW] [`src/components/settings/PrivacyTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/PrivacyTab.tsx)
- Default attendance visibility (Private, Friends, Public) with plain-English descriptions.
- Friend discovery and networking pass toggles.
- Photo appearance opt-out toggle.
- Blocked users list with immediate "Unblock" button.

#### [NEW] [`src/components/settings/SecurityTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/SecurityTab.tsx)
- Password update form with current password validation.
- Institutional email confirmation status with "Resend Verification Email".
- Active session card with "Sign Out of Other Devices" button.
- 2FA security status toggle.
- Recent Security Activity audit log table with action badges, timestamps, and IP addresses.

#### [NEW] [`src/components/settings/DataTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/DataTab.tsx)
- Personal Data Export button with instant JSON payload generation.
- Direct links to Registration History and Issued Certificates on My Events.
- Delete Account workflow:
  - Destructive dialog explaining consequences.
  - Requires typing `"DELETE MY ACCOUNT"`.
  - Schedules 14-day deletion window with a "Cancel Deletion" option.
- Safety and legal links: Privacy Policy, Terms, Support Contact, Report Safety Issue.

#### [NEW] [`src/components/settings/OrganizerWorkspaceTab.tsx`](file:///Users/apple/milan/hub/Eventhub/src/components/settings/OrganizerWorkspaceTab.tsx)
- Event creation defaults: Default Timezone, Default Campus Venue (from `campus_venues`), Default Category, Default Accessibility Statement, Default Contact Email.
- Notification defaults: new registration alerts, volunteer application alerts, attendee feedback alerts.
- Default team invite permissions.

---

### 5. Automated Tests

#### [NEW] [`src/lib/__tests__/phase16-customer-grade-settings.test.ts`](file:///Users/apple/milan/hub/Eventhub/src/lib/__tests__/phase16-customer-grade-settings.test.ts)
- Privacy settings & default visibility isolation (private, friends, public).
- Friend request discoverability and unblocking behavior.
- Authorization boundary guards: users cannot elevate roles or self-verify organizer status.
- Campus change impact calculations and event transfer prohibition.
- Notification preferences and quiet hours calculation.
- Public profile field visibility masking in `organizer_profiles`.
- Account deletion 14-day scheduling and cancellation logic.
- Security audit log generation on sensitive account mutations.

#### [MODIFY] [`tests/rls/migrations-transactional-safety.test.ts`](file:///Users/apple/milan/hub/Eventhub/tests/rls/migrations-transactional-safety.test.ts)
- Update migration count to 26 and assert `20260912190000_phase16_account_center_settings.sql`.

---

## Verification Plan

### Automated Tests
1. `npm run typecheck` (`tsc --noEmit`) to verify 0 TypeScript errors.
2. `npm run lint` (`eslint src/`) to ensure clean code with 0 warnings.
3. `npx vitest run` to run all 30 test suites and verify all tests pass.
4. `npm run build` to verify Next.js 16 production build compiles all routes cleanly.

### Manual & Integration Verification
1. Verify `/settings` loads with URL tab navigation (`?tab=profile`, `?tab=campus`, `?tab=notifications`, `?tab=privacy`, `?tab=security`, `?tab=data`, `?tab=organizer`).
2. Test mobile responsive drawer/pills navigation.
3. Test personal data JSON export.
4. Test quiet hours and notification toggles.
5. Test campus impact warning for organizers.
6. Test account deletion scheduling and cancellation window.
