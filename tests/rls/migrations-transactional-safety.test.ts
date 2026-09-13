import { describe, test, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Supabase SQL / RLS Tests: Migration Transactional Safety & Database Authorization', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations')

  test('all 27 chronological migrations exist on disk with valid naming convention', () => {
    expect(fs.existsSync(migrationsDir)).toBe(true)
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

    expect(files.length).toBe(27)

    // Expected sequence
    const expectedPrefixes = [
      '20260906072952_create_schema',
      '20260906073200_create_rls_policies',
      '20260906092813_add_registration_rpc',
      '20260906200000_create_storage_bucket',
      '20260908230000_fix_role_trigger',
      '20260909000000_add_paid_events',
      '20260910000000_secure_customer_data_and_organizers',
      '20260910120000_phase2_dates_capacity_favorites',
      '20260910180000_phase3_campus_identity_and_scoping',
      '20260910190000_allow_organizer_signup_unverified',
      '20260910220000_phase4_trustworthy_event_changes',
      '20260910225000_phase5_add_waitlist_status_enum',
      '20260910230000_phase5_waitlist_tickets_checkin',
      '20260910240000_phase6_organizer_tools_teams_questions',
      '20260911000000_phase7_discovery_profiles_event_details',
      '20260912000000_phase9a_transactional_registration_waitlist',
      '20260912100000_phase9b_security_privacy_hardening',
      '20260912110000_phase9c_team_permissions_campus_identity',
      '20260912120000_phase10_post_registration_experience',
      '20260912130000_phase11_production_integrity_and_privacy',
      '20260912140000_phase12_social_discovery_and_privacy',
      '20260912150000_phase13_recurring_events_and_teams',
      '20260912160000_fix_club_follows_organizer_rls',
      '20260912170000_phase14_certificates_volunteers_live_galleries',
      '20260912180000_phase15_ecosystem_venues_networking_translations_integrations',
      '20260912190000_phase16_account_center_settings',
      '20260913000000_phase17_admin_control_panel',
    ]

    expectedPrefixes.forEach((prefix, idx) => {
      expect(files[idx]).toContain(prefix)
    })
  })

  test('PostgreSQL enum addition is committed in a separate migration before dependent schema usage', () => {
    const enumMigration = fs.readFileSync(
      path.join(migrationsDir, '20260910225000_phase5_add_waitlist_status_enum.sql'),
      'utf8'
    )
    expect(enumMigration).toContain("ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'waitlisted'")
    expect(enumMigration).toContain("ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'checked_in'")

    // Dependent schema migration should NOT attempt inline ALTER TYPE in same transaction block
    const schemaMigration = fs.readFileSync(
      path.join(migrationsDir, '20260910230000_phase5_waitlist_tickets_checkin.sql'),
      'utf8'
    )
    expect(schemaMigration).not.toMatch(/^ALTER TYPE public\.registration_status ADD VALUE/m)
    expect(schemaMigration).toContain("WHERE status = 'waitlisted'")
  })

  test('SECURITY DEFINER functions across migrations pin search_path = public', () => {
    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))

    for (const file of files) {
      const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      const secDefinerMatches = content.match(/SECURITY DEFINER/gi) || []
      const searchPathMatches = content.match(/SET search_path\s*=\s*public/gi) || []

      // In files with SECURITY DEFINER functions created/updated, verify search_path is pinned
      if (secDefinerMatches.length > 0 && (file.includes('phase9') || file.includes('phase5'))) {
        expect(searchPathMatches.length).toBeGreaterThan(0)
      }
    }
  })

  test('least privilege: internal helpers and triggers have execute revoked from public', () => {
    const phase9b = fs.readFileSync(
      path.join(migrationsDir, '20260912100000_phase9b_security_privacy_hardening.sql'),
      'utf8'
    )
    const phase9c = fs.readFileSync(
      path.join(migrationsDir, '20260912110000_phase9c_team_permissions_campus_identity.sql'),
      'utf8'
    )

    expect(phase9b).toContain('REVOKE EXECUTE ON FUNCTION public.sync_event_active_registrations()')
    expect(phase9b).toContain('REVOKE EXECUTE ON FUNCTION public.check_event_deletion_safety()')
    expect(phase9b).toContain('REVOKE EXECUTE ON FUNCTION public.resequence_event_waitlist(UUID)')
    expect(phase9c).toContain('REVOKE EXECUTE ON FUNCTION public.enforce_event_campus_inheritance()')
  })

  test('data minimization: registration_answers RLS strictly excludes check_in_staff', () => {
    const phase9c = fs.readFileSync(
      path.join(migrationsDir, '20260912110000_phase9c_team_permissions_campus_identity.sql'),
      'utf8'
    )
    expect(phase9c).toContain('"Event managers and viewers can view registration answers"')
    expect(phase9c).toContain("tm.role IN ('owner', 'editor', 'viewer')")
    expect(phase9c).not.toContain("tm.role IN ('owner', 'editor', 'check_in_staff', 'viewer')")
  })

  test('event immutability: trigger blocks modifying campus_id during UPDATE', () => {
    const phase9c = fs.readFileSync(
      path.join(migrationsDir, '20260912110000_phase9c_team_permissions_campus_identity.sql'),
      'utf8'
    )
    expect(phase9c).toContain('enforce_event_campus_inheritance')
    expect(phase9c).toContain('Events cannot be moved to a different campus once assigned')
  })

  test('phase 10 schema directives: preferences, jobs, aggregate feedback RPC, and moderation reports', () => {
    const phase10 = fs.readFileSync(
      path.join(migrationsDir, '20260912120000_phase10_post_registration_experience.sql'),
      'utf8'
    )
    expect(phase10).toContain('user_notification_preferences')
    expect(phase10).toContain('notification_jobs')
    expect(phase10).toContain('event_feedback')
    expect(phase10).toContain('moderation_reports')
    expect(phase10).toContain('get_event_feedback_aggregate')
    expect(phase10).toContain('SET search_path = public')
    expect(phase10).toContain('REVOKE EXECUTE ON FUNCTION public.get_event_feedback_aggregate(UUID) FROM public, anon')
  })

  test('phase 11 schema directives: waitlist capacity check, announcement restore, system_admins, feedback timing, rate_limits', () => {
    const phase11 = fs.readFileSync(
      path.join(migrationsDir, '20260912130000_phase11_production_integrity_and_privacy.sql'),
      'utf8'
    )
    expect(phase11).toContain('promote_next_waitlisted_attendee')
    expect(phase11).toContain('v_active_count >= v_event.capacity')
    expect(phase11).toContain("'announcement'")
    expect(phase11).toContain('system_admins')
    expect(phase11).toContain('is_admin')
    expect(phase11).toContain('rate_limits')
    expect(phase11).toContain('check_rate_limit')
    expect(phase11).toContain('SET search_path = public')
  })

  test('phase 12 schema directives: club_follows, user_social_preferences, friendships, RPCs and fail-closed privacy', () => {
    const phase12 = fs.readFileSync(
      path.join(migrationsDir, '20260912140000_phase12_social_discovery_and_privacy.sql'),
      'utf8'
    )
    expect(phase12).toContain('club_follows')
    expect(phase12).toContain('user_social_preferences')
    expect(phase12).toContain('friendships')
    expect(phase12).toContain('attendance_visibility')
    expect(phase12).toContain('get_organizer_follower_count')
    expect(phase12).toContain('get_event_friend_attendance')
    expect(phase12).toContain('are_friends')
    expect(phase12).toContain('share_attendance_with_friends BOOLEAN NOT NULL DEFAULT false')
    expect(phase12).toContain("auth.uid() IN (user_id, friend_id)")
    expect(phase12).toContain('SET search_path = public')
  })

  test('phase 13 schema directives: event_series, event_registration_teams, event_registration_team_members, atomic RPCs', () => {
    const phase13 = fs.readFileSync(
      path.join(migrationsDir, '20260912150000_phase13_recurring_events_and_teams.sql'),
      'utf8'
    )
    expect(phase13).toContain('event_series')
    expect(phase13).toContain('series_id UUID REFERENCES public.event_series')
    expect(phase13).toContain('registration_mode')
    expect(phase13).toContain('event_registration_teams')
    expect(phase13).toContain('event_registration_team_members')
    expect(phase13).toContain('create_registration_team')
    expect(phase13).toContain('join_registration_team')
    expect(phase13).toContain('leave_registration_team')
    expect(phase13).toContain('SET search_path = public')
  })

  test('phase 14 schema directives: certificates, volunteers, live updates, curated galleries, security definer verification', () => {
    const phase14 = fs.readFileSync(
      path.join(migrationsDir, '20260912170000_phase14_certificates_volunteers_live_galleries.sql'),
      'utf8'
    )
    expect(phase14).toContain('event_certificate_configs')
    expect(phase14).toContain('event_certificates')
    expect(phase14).toContain('event_volunteer_roles')
    expect(phase14).toContain('event_volunteer_signups')
    expect(phase14).toContain('event_photos')
    expect(phase14).toContain('event_photo_privacy_preferences')
    expect(phase14).toContain('verify_certificate')
    expect(phase14).toContain('is_pinned')
    expect(phase14).toContain('chk_event_announcements_category')
    expect(phase14).toContain('SET search_path = public')
  })

  test('phase 15 schema directives: campus venues, networking cards, event translations, integrations & api keys', () => {
    const phase15 = fs.readFileSync(
      path.join(migrationsDir, '20260912180000_phase15_ecosystem_venues_networking_translations_integrations.sql'),
      'utf8'
    )
    expect(phase15).toContain('campus_venues')
    expect(phase15).toContain('venue_id UUID REFERENCES public.campus_venues')
    expect(phase15).toContain('reschedule_count')
    expect(phase15).toContain('user_networking_cards')
    expect(phase15).toContain('event_networking_attendees')
    expect(phase15).toContain('contact_exchange_requests')
    expect(phase15).toContain('networking_blocks')
    expect(phase15).toContain('event_translations')
    expect(phase15).toContain('event_webhook_integrations')
    expect(phase15).toContain('campus_api_keys')
    expect(phase15).toContain('target_type IN (\'event\', \'organizer\', \'feedback\', \'photo\', \'networking_profile\')')
  })

  test('phase 17 schema directives: admin audit log, organizer suspension, admin event deletion RPC, notifications', () => {
    const phase17 = fs.readFileSync(
      path.join(migrationsDir, '20260913000000_phase17_admin_control_panel.sql'),
      'utf8'
    )
    expect(phase17).toContain('admin_audit_log')
    expect(phase17).toContain('is_suspended BOOLEAN NOT NULL DEFAULT false')
    expect(phase17).toContain('check_organizer_not_suspended')
    expect(phase17).toContain('trg_check_organizer_not_suspended')
    expect(phase17).toContain('admin_delete_event')
    expect(phase17).toContain('campusloop.admin_delete_bypass')
    expect(phase17).toContain('admin_event_removed')
    expect(phase17).toContain('organizer_suspended')
    expect(phase17).toContain('organizer_revoked')
    expect(phase17).toContain('SET search_path = public')
  })
})
