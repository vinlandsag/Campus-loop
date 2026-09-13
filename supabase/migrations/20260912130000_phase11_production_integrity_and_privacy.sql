-- ==============================================================================
-- Migration: Phase 11 - Production Integrity, Authorization & Privacy Hardening
-- ==============================================================================

-- ─── 1. Waitlist Promotion Capacity Check ─────────────────────────────────────
-- Standalone waitlist promotion MUST lock the event, verify available capacity,
-- and fail closed if the event is full.
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
  v_event RECORD;
  v_new_ticket_code TEXT;
  v_active_count INTEGER;
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

  -- 1. Fetch & lock event row
  SELECT id, title, slug, capacity INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- 2. Verify capacity: Count current active registrations
  IF v_event.capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.registrations
    WHERE event_id = p_event_id AND status IN ('registered', 'checked_in');

    IF v_active_count >= v_event.capacity THEN
      RETURN json_build_object('success', false, 'error', 'Event is at full capacity. Cannot promote waitlisted attendee.');
    END IF;
  END IF;

  -- 3. Atomically select the earliest waitlisted attendee for update
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

  -- 4. Generate non-guessable ticket code
  v_new_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event.slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));

  -- 5. Promote attendee to registered
  UPDATE public.registrations
  SET
    status = 'registered',
    ticket_code = v_new_ticket_code,
    waitlist_position = NULL,
    registered_at = NOW()
  WHERE id = v_waitlist_id;

  -- 6. Create in-app notification for the promoted student
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
    'A spot opened up for "' || v_event.title || '" and you have been promoted from the waitlist.',
    '/events/' || v_event.slug,
    false,
    NOW()
  );

  -- 7. Resequence remaining waitlist positions
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

-- ─── 2. Restore Announcement in Notification Types ───────────────────────────
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
      'announcement'
    ));
END $$;

-- ─── 3. Dedicated Server-Controlled Admin Authorization Model ─────────────────
-- Dedicated table for system administrators that normal users cannot write
CREATE TABLE IF NOT EXISTS public.system_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_admins_user ON public.system_admins (user_id);
ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

-- Helper function to check admin privileges:
-- Checks server-controlled app_metadata (immutable by client), system_admins table, or service_role.
-- NEVER trusts user_metadata.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    (auth.jwt()->'app_metadata'->>'role') = 'admin'
    OR (auth.jwt()->'app_metadata'->>'is_admin')::boolean = true
    OR EXISTS (
      SELECT 1 FROM public.system_admins
      WHERE user_id = COALESCE(p_user_id, auth.uid())
    )
    OR auth.role() = 'service_role'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can view system admins" ON public.system_admins;
CREATE POLICY "Admins can view system admins"
  ON public.system_admins FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin()
  );

-- Update moderation_reports policies to use public.is_admin() (removing mutable user_metadata)
DROP POLICY IF EXISTS "Admins can view all moderation reports" ON public.moderation_reports;
CREATE POLICY "Admins can view all moderation reports"
  ON public.moderation_reports FOR SELECT
  USING (
    public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can update moderation reports" ON public.moderation_reports;
CREATE POLICY "Admins can update moderation reports"
  ON public.moderation_reports FOR UPDATE
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

-- ─── 4. Event Feedback Timing Constraint ──────────────────────────────────────
-- Attendees can submit feedback only after event end time, OR if checked in and event has started.
DROP POLICY IF EXISTS "Registered attendees can insert feedback" ON public.event_feedback;
CREATE POLICY "Registered attendees can insert feedback"
  ON public.event_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.event_id = event_feedback.event_id
        AND r.user_id = auth.uid()
        AND r.status IN ('registered', 'checked_in')
        AND (
          -- Event end time has passed
          (NOW() >= (e.event_date + e.end_time) AT TIME ZONE COALESCE(e.timezone, 'UTC'))
          OR
          -- Checked in and event start time has passed
          (r.status = 'checked_in' AND NOW() >= (e.event_date + e.start_time) AT TIME ZONE COALESCE(e.timezone, 'UTC'))
        )
    )
  );

DROP POLICY IF EXISTS "Attendees can update own feedback" ON public.event_feedback;
CREATE POLICY "Attendees can update own feedback"
  ON public.event_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.event_id = event_feedback.event_id
        AND r.user_id = auth.uid()
        AND r.status IN ('registered', 'checked_in')
        AND (
          (NOW() >= (e.event_date + e.end_time) AT TIME ZONE COALESCE(e.timezone, 'UTC'))
          OR
          (r.status = 'checked_in' AND NOW() >= (e.event_date + e.start_time) AT TIME ZONE COALESCE(e.timezone, 'UTC'))
        )
    )
  );

-- ─── 5. Notification Jobs Enhancements ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_jobs' AND column_name = 'attempts'
  ) THEN
    ALTER TABLE public.notification_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification_jobs' AND column_name = 'max_attempts'
  ) THEN
    ALTER TABLE public.notification_jobs ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
  END IF;
END $$;

-- ─── 6. Durable Abuse / Rate Limiting ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  action TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_rate_limits_key_action UNIQUE (key, action)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_action
  ON public.rate_limits (key, action, expires_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomic durable rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_action TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_record RECORD;
  v_remaining INTEGER;
  v_reset_at TIMESTAMPTZ;
BEGIN
  -- 1. Try to find existing active window
  SELECT id, count, window_start, expires_at
  INTO v_record
  FROM public.rate_limits
  WHERE key = p_key AND action = p_action
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First request in window
    INSERT INTO public.rate_limits (key, action, count, window_start, expires_at)
    VALUES (p_key, p_action, 1, v_now, v_now + (p_window_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key, action) DO UPDATE
      SET count = 1,
          window_start = v_now,
          expires_at = v_now + (p_window_seconds || ' seconds')::INTERVAL
    RETURNING id, count, window_start, expires_at INTO v_record;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_record.expires_at
    );
  END IF;

  -- Window expired? Reset window
  IF v_record.expires_at <= v_now THEN
    UPDATE public.rate_limits
    SET count = 1,
        window_start = v_now,
        expires_at = v_now + (p_window_seconds || ' seconds')::INTERVAL
    WHERE id = v_record.id
    RETURNING expires_at INTO v_reset_at;

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests - 1,
      'reset_at', v_reset_at
    );
  END IF;

  -- Within active window: Check count
  IF v_record.count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', v_record.expires_at,
      'retry_after_seconds', GREATEST(1, EXTRACT(EPOCH FROM (v_record.expires_at - v_now))::INTEGER)
    );
  END IF;

  -- Increment count
  UPDATE public.rate_limits
  SET count = count + 1
  WHERE id = v_record.id
  RETURNING expires_at INTO v_reset_at;

  v_remaining := p_max_requests - (v_record.count + 1);

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_remaining,
    'reset_at', v_reset_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO authenticated, service_role;
