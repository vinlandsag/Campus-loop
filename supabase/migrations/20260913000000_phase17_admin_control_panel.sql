-- ==============================================================================
-- Migration: Phase 17 — Admin Control Panel
-- Forward-only. Does NOT alter payment functionality.
-- ==============================================================================

-- ─── 1. Admin Audit Log (immutable) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin
  ON public.admin_audit_log (admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action
  ON public.admin_audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target
  ON public.admin_audit_log (target_type, target_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Only admins or service_role can insert audit entries
DROP POLICY IF EXISTS "Admins can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Service role can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- No UPDATE or DELETE policies — audit log is immutable

-- ─── 2. Profile Suspension Support ───────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

-- Prevent suspended organizers from creating/updating events
CREATE OR REPLACE FUNCTION public.check_organizer_not_suspended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = NEW.organizer_id
      AND is_suspended = true
  ) THEN
    RAISE EXCEPTION 'Suspended organizers cannot create or modify events.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_organizer_not_suspended ON public.events;
CREATE TRIGGER trg_check_organizer_not_suspended
  BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.check_organizer_not_suspended();

-- Update organizer_profiles view to exclude suspended organizers
CREATE OR REPLACE VIEW public.organizer_profiles WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  avatar_url,
  is_verified,
  campus_id,
  bio,
  website_url,
  instagram_handle,
  CASE WHEN show_email = true THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_college = true THEN college ELSE NULL END AS college,
  CASE WHEN show_department = true THEN department ELSE NULL END AS department
FROM public.profiles
WHERE role = 'organizer' AND is_verified = true AND is_suspended = false;

GRANT SELECT ON public.organizer_profiles TO anon, authenticated;

-- ─── 3. Expanded Notification Types ──────────────────────────────────────────
DO $$
BEGIN
  ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE public.notifications
    ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'registration_confirmed',
      'event_cancelled',
      'event_rescheduled',
      'venue_changed',
      'reminder_24h',
      'reminder_1h',
      'waitlist_promoted',
      'checked_in',
      'reminder',
      'announcement',
      'admin_event_removed',
      'organizer_suspended',
      'organizer_revoked'
    ));
END $$;

-- ─── 4. Admin RLS Policies for Profiles (read all for admin) ─────────────────
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin can update any profile (for suspension, role changes)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 5. Admin RLS Policies for Campuses ──────────────────────────────────────
-- Admins can read ALL campuses (including inactive)
DROP POLICY IF EXISTS "Admins can read all campuses" ON public.campuses;
CREATE POLICY "Admins can read all campuses"
  ON public.campuses FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins can create campuses
DROP POLICY IF EXISTS "Admins can insert campuses" ON public.campuses;
CREATE POLICY "Admins can insert campuses"
  ON public.campuses FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admins can update campuses
DROP POLICY IF EXISTS "Admins can update campuses" ON public.campuses;
CREATE POLICY "Admins can update campuses"
  ON public.campuses FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 6. Admin RLS Policies for Events (read/delete all) ─────────────────────
DROP POLICY IF EXISTS "Admins can read all events" ON public.events;
CREATE POLICY "Admins can read all events"
  ON public.events FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete any event" ON public.events;
CREATE POLICY "Admins can delete any event"
  ON public.events FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── 7. Admin Event Deletion RPC ─────────────────────────────────────────────
-- Modify the deletion safety trigger to allow admin bypass via session variable
CREATE OR REPLACE FUNCTION public.check_event_deletion_safety()
RETURNS trigger AS $$
DECLARE
  v_registration_count INTEGER;
  v_admin_bypass TEXT;
BEGIN
  -- Check for admin bypass flag (set by admin_delete_event RPC)
  BEGIN
    v_admin_bypass := current_setting('campusloop.admin_delete_bypass', true);
  EXCEPTION WHEN OTHERS THEN
    v_admin_bypass := '';
  END;

  IF v_admin_bypass = 'true' THEN
    RETURN OLD;
  END IF;

  SELECT count(*) INTO v_registration_count
  FROM public.registrations
  WHERE event_id = OLD.id;

  IF v_registration_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete an event that has registrations (found % registered attendees). The event must be cancelled with an explanation instead.', v_registration_count;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin event deletion function
CREATE OR REPLACE FUNCTION public.admin_delete_event(
  p_event_id UUID,
  p_reason TEXT,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_event RECORD;
  v_reg_count INTEGER;
  v_waitlist_count INTEGER;
  v_affected_users UUID[];
  v_event_snapshot JSONB;
BEGIN
  -- 1. Verify admin
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL OR NOT public.is_admin(v_admin_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin privileges required');
  END IF;

  -- 2. Fetch event
  SELECT id, title, slug, organizer_id, campus_id, status, category, location,
         event_date, start_time, end_time, capacity
  INTO v_event
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- 3. Build event snapshot for audit
  v_event_snapshot := jsonb_build_object(
    'title', v_event.title,
    'slug', v_event.slug,
    'organizer_id', v_event.organizer_id,
    'campus_id', v_event.campus_id,
    'status', v_event.status,
    'category', v_event.category,
    'location', v_event.location,
    'event_date', v_event.event_date,
    'capacity', v_event.capacity
  );

  -- 4. Count affected users
  SELECT COUNT(*) INTO v_reg_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'checked_in');

  SELECT COUNT(*) INTO v_waitlist_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status = 'waitlisted';

  -- 5. Collect affected user IDs for notifications
  SELECT ARRAY_AGG(DISTINCT user_id) INTO v_affected_users
  FROM public.registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'checked_in', 'waitlisted');

  -- 6. Write immutable audit record BEFORE deletion
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, reason, metadata)
  VALUES (
    v_admin_id,
    'event_deleted',
    'event',
    p_event_id::TEXT,
    COALESCE(p_reason, 'No reason provided'),
    jsonb_build_object(
      'event_snapshot', v_event_snapshot,
      'admin_notes', p_admin_notes,
      'registered_count', v_reg_count,
      'waitlisted_count', v_waitlist_count,
      'affected_user_count', COALESCE(array_length(v_affected_users, 1), 0)
    )
  );

  -- 7. Delete associated data (order matters for FK constraints)
  DELETE FROM public.registration_answers
  WHERE registration_id IN (SELECT id FROM public.registrations WHERE event_id = p_event_id);

  DELETE FROM public.event_feedback WHERE event_id = p_event_id;
  DELETE FROM public.event_certificates WHERE event_id = p_event_id;
  DELETE FROM public.event_certificate_configs WHERE event_id = p_event_id;
  DELETE FROM public.event_volunteer_signups WHERE event_id = p_event_id;
  DELETE FROM public.event_volunteer_roles WHERE event_id = p_event_id;
  DELETE FROM public.event_photos WHERE event_id = p_event_id;
  DELETE FROM public.event_announcements WHERE event_id = p_event_id;
  DELETE FROM public.event_registration_questions WHERE event_id = p_event_id;
  DELETE FROM public.event_team_members WHERE event_id = p_event_id;
  DELETE FROM public.notification_jobs WHERE event_id = p_event_id;
  DELETE FROM public.event_translations WHERE event_id = p_event_id;
  DELETE FROM public.event_webhook_integrations WHERE event_id = p_event_id;
  DELETE FROM public.registrations WHERE event_id = p_event_id;
  DELETE FROM public.favorites WHERE event_id = p_event_id;

  -- Update notifications to SET NULL for event_id (they have ON DELETE SET NULL)
  UPDATE public.notifications SET event_id = NULL WHERE event_id = p_event_id;

  -- 8. Set admin bypass flag and delete the event
  PERFORM set_config('campusloop.admin_delete_bypass', 'true', true);

  DELETE FROM public.events WHERE id = p_event_id;

  -- Reset bypass flag
  PERFORM set_config('campusloop.admin_delete_bypass', '', true);

  -- 9. Send notifications to affected users
  IF v_affected_users IS NOT NULL AND array_length(v_affected_users, 1) > 0 THEN
    INSERT INTO public.notifications (user_id, type, title, message, is_read)
    SELECT
      unnest(v_affected_users),
      'admin_event_removed',
      'Event Removed',
      'The event "' || v_event.title || '" has been removed by CampusLoop moderation. If you were registered, your registration has been cancelled.',
      false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_event_title', v_event.title,
    'affected_users', COALESCE(array_length(v_affected_users, 1), 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_event(UUID, TEXT, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ─── 8. Admin RLS on Registrations (read all for admin) ─────────────────────
DROP POLICY IF EXISTS "Admins can read all registrations" ON public.registrations;
CREATE POLICY "Admins can read all registrations"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ─── 9. Seed Admin User (commented out — uncomment and set your user ID) ────
-- To bootstrap the first admin, run this via supabase sql or dashboard:
-- INSERT INTO public.system_admins (user_id, granted_by)
-- VALUES ('YOUR-AUTH-USER-UUID-HERE', 'YOUR-AUTH-USER-UUID-HERE')
-- ON CONFLICT (user_id) DO NOTHING;

-- ─── 10. Least-Privilege Grants ──────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.check_organizer_not_suspended() FROM public, anon, authenticated;
