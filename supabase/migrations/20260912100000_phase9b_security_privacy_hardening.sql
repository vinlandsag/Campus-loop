-- Migration: 20260912100000_phase9b_security_privacy_hardening.sql
-- Description: Phase 9B: Close security, privacy, and access control gaps.

-- 1. Hardening Notification INSERT RLS
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Privileged or authorized event notifications" ON public.notifications;

CREATE POLICY "Privileged or authorized event notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    -- Service role can insert anything
    auth.role() = 'service_role'
    -- Attendees can only insert self-notifications for legitimate self-service flows
    OR (auth.uid() = user_id AND type IN ('registration_confirmed', 'checked_in'))
    -- Organizers and team editors/owners can insert notifications for attendees of their events
    OR (
      event_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = notifications.event_id AND e.organizer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.event_team_members m
          WHERE m.event_id = notifications.event_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
        )
      )
    )
  );

-- 2. Restrict Registration Questions RLS to Published Events & Event Staff
DROP POLICY IF EXISTS "Public can view questions for active events" ON public.event_registration_questions;
DROP POLICY IF EXISTS "Read registration questions for published events or by event team" ON public.event_registration_questions;

CREATE POLICY "Read registration questions for published events or by event team"
  ON public.event_registration_questions
  FOR SELECT
  USING (
    -- Public attendees can view questions for published events
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_registration_questions.event_id AND e.status = 'published'
    )
    -- Event organizers can view questions for their own draft/active events
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_registration_questions.event_id AND e.organizer_id = auth.uid()
    )
    -- Team members can view questions for their events
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_registration_questions.event_id AND m.user_id = auth.uid()
    )
  );

-- 3. Explicit Public Organizer Profile Contract
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_college BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_department BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_email BOOLEAN NOT NULL DEFAULT false;

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
WHERE role = 'organizer' AND is_verified = true;

GRANT SELECT ON public.organizer_profiles TO anon, authenticated;

-- Helper RPC for safe public organizer profile lookups
DROP FUNCTION IF EXISTS public.get_organizer_profile(UUID);
CREATE OR REPLACE FUNCTION public.get_organizer_profile(p_organizer_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN,
  campus_id UUID,
  bio TEXT,
  website_url TEXT,
  instagram_handle TEXT,
  contact_email TEXT,
  college TEXT,
  department TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE id = p_organizer_id AND role = 'organizer' AND is_verified = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_organizer_profile(UUID) TO anon, authenticated;

-- Computed relationship on events for PostgREST
DROP FUNCTION IF EXISTS public.organizer(public.events);
CREATE OR REPLACE FUNCTION public.organizer(events public.events)
RETURNS public.organizer_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.organizer_profiles
  WHERE id = $1.organizer_id;
$$;

GRANT EXECUTE ON FUNCTION public.organizer(public.events) TO anon, authenticated;

-- 4. Audit SECURITY DEFINER Functions & Enforce Least-Privilege Grants

-- A. Lock down promote_next_waitlisted_attendee to verify organizer/editor authorization
CREATE OR REPLACE FUNCTION public.promote_next_waitlisted_attendee(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_waitlist_id UUID;
  v_waitlist_user_id UUID;
  v_event_title TEXT;
  v_event_slug TEXT;
  v_new_ticket_code TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify caller is authorized organizer or team editor/owner
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND organizer_id = v_caller_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_team_members
    WHERE event_id = p_event_id AND user_id = v_caller_id AND role IN ('owner', 'editor')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Only event organizers or editors can promote waitlist attendees');
  END IF;

  -- 1. Fetch event metadata
  SELECT title, slug INTO v_event_title, v_event_slug
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- 2. Atomically select the earliest waitlisted attendee for update
  SELECT id, user_id INTO v_waitlist_id, v_waitlist_user_id
  FROM public.registrations
  WHERE event_id = p_event_id AND status = 'waitlisted'
  ORDER BY registered_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no one is on waitlist, return
  IF v_waitlist_id IS NULL THEN
    RETURN json_build_object('success', true, 'promoted', false);
  END IF;

  -- 3. Generate non-guessable ticket code
  v_new_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event_slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));

  -- 4. Promote attendee to registered
  UPDATE public.registrations
  SET
    status = 'registered',
    ticket_code = v_new_ticket_code,
    waitlist_position = NULL,
    registered_at = NOW()
  WHERE id = v_waitlist_id;

  -- 5. Create in-app notification for the promoted student
  INSERT INTO public.notifications (
    user_id,
    event_id,
    type,
    title,
    message,
    link,
    is_read,
    created_at
  ) VALUES (
    v_waitlist_user_id,
    p_event_id,
    'waitlist_promoted',
    'You got a spot!',
    'A spot opened up for "' || v_event_title || '" and you have been promoted from the waitlist.',
    '/events/' || v_event_slug,
    false,
    NOW()
  );

  -- 6. Resequence remaining waitlist positions
  PERFORM public.resequence_event_waitlist(p_event_id);

  RETURN json_build_object(
    'success', true,
    'promoted', true,
    'registration_id', v_waitlist_id,
    'user_id', v_waitlist_user_id,
    'ticket_code', v_new_ticket_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_next_waitlisted_attendee(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.promote_next_waitlisted_attendee(UUID) TO authenticated;

-- B. Harden check_in_attendee with scoped event-team authorization
CREATE OR REPLACE FUNCTION public.check_in_attendee(p_event_id UUID, p_ticket_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_authorized BOOLEAN;
  v_registration RECORD;
  v_user_profile RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify organizer or authorized team staff (owner, editor, check_in_staff)
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND organizer_id = v_caller_id
  ) OR EXISTS (
    SELECT 1 FROM public.event_team_members
    WHERE event_id = p_event_id AND user_id = v_caller_id AND role IN ('owner', 'editor', 'check_in_staff')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: You do not have check-in permissions for this event');
  END IF;

  -- Find registration by ticket code
  SELECT r.id, r.event_id, r.user_id, r.status, r.ticket_code, r.checked_in_at
  INTO v_registration
  FROM public.registrations r
  WHERE r.ticket_code = p_ticket_code;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  -- Prevent a ticket from one event being used for another
  IF v_registration.event_id != p_event_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid ticket: This ticket belongs to a different event'
    );
  END IF;

  -- Fetch attendee profile
  SELECT full_name, email INTO v_user_profile
  FROM public.profiles
  WHERE id = v_registration.user_id;

  -- Idempotent check: already checked in
  IF v_registration.status = 'checked_in' THEN
    RETURN json_build_object(
      'success', true,
      'already_checked_in', true,
      'checked_in_at', v_registration.checked_in_at,
      'attendee', json_build_object(
        'id', v_registration.user_id,
        'full_name', v_user_profile.full_name,
        'email', v_user_profile.email
      )
    );
  END IF;

  -- Reject if waitlisted or cancelled
  IF v_registration.status != 'registered' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot check in: attendee status is ' || v_registration.status
    );
  END IF;

  -- Mark as checked in
  UPDATE public.registrations
  SET
    status = 'checked_in',
    checked_in_at = NOW(),
    checked_in_by = v_caller_id
  WHERE id = v_registration.id;

  RETURN json_build_object(
    'success', true,
    'already_checked_in', false,
    'checked_in_at', NOW(),
    'attendee', json_build_object(
      'id', v_registration.user_id,
      'full_name', v_user_profile.full_name,
      'email', v_user_profile.email
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_in_attendee(UUID, TEXT) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_in_attendee(UUID, TEXT) TO authenticated;

-- C. Revoke direct public execution on internal helpers and triggers
REVOKE EXECUTE ON FUNCTION public.resequence_event_waitlist(UUID) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_event_deletion_safety() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_event_active_registrations() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;
