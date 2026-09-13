-- Phase 10: Post-Registration Experience, Delivery Tracking, Moderation & Feedback
-- Forward-only migration 20260912120000

-- 1. User Notification Preferences
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_24h BOOLEAN NOT NULL DEFAULT true,
  reminder_1h BOOLEAN NOT NULL DEFAULT true,
  event_updates BOOLEAN NOT NULL DEFAULT true,
  waitlist_promotions BOOLEAN NOT NULL DEFAULT true,
  marketing_announcements BOOLEAN NOT NULL DEFAULT false,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can read own notification preferences"
  ON public.user_notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can insert own notification preferences"
  ON public.user_notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notification preferences" ON public.user_notification_preferences;
CREATE POLICY "Users can update own notification preferences"
  ON public.user_notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Alter Notifications for Email Delivery Tracking & Deduplication
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'skipped_no_provider',
  ADD COLUMN IF NOT EXISTS email_recipient TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_provider TEXT NULL,
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS email_error TEXT NULL,
  ADD COLUMN IF NOT EXISTS dedup_key TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_email_status_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_email_status_check
      CHECK (email_status IN ('pending', 'sent', 'skipped_no_provider', 'failed', 'opted_out'));
  END IF;
END $$;

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
      'reminder'
    ));
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_dedup
  ON public.notifications (user_id, event_id, type, dedup_key);

-- 3. Scheduled Notification Jobs
CREATE TABLE IF NOT EXISTS public.notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('reminder_24h', 'reminder_1h', 'reschedule', 'venue_change', 'cancellation', 'registration_confirmed', 'waitlist_promoted')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  recipients_count INTEGER NOT NULL DEFAULT 0,
  emails_sent_count INTEGER NOT NULL DEFAULT 0,
  emails_skipped_count INTEGER NOT NULL DEFAULT 0,
  error TEXT NULL,
  processed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_pending
  ON public.notification_jobs (status, scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;

-- Security definer helper to check event organizer without triggering cross-table RLS cycles
CREATE OR REPLACE FUNCTION public.is_event_organizer(p_event_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND organizer_id = p_user_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_event_organizer(UUID, UUID) TO authenticated, service_role;

-- Security definer helper to check team role without triggering cross-table RLS cycles
CREATE OR REPLACE FUNCTION public.has_event_team_role(
  p_event_id UUID,
  p_user_id UUID,
  p_roles TEXT[] DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_team_members
    WHERE event_id = p_event_id
      AND user_id = p_user_id
      AND (p_roles IS NULL OR role::text = ANY(p_roles))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_event_team_role(UUID, UUID, TEXT[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.has_event_team_role(UUID, UUID, TEXT[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "Team members can view event notification jobs" ON public.notification_jobs;
CREATE POLICY "Team members can view event notification jobs"
  ON public.notification_jobs FOR SELECT
  USING (
    public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid())
  );

-- 4. Event Feedback (Private & Aggregate Privacy)
CREATE TABLE IF NOT EXISTS public.event_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT NULL,
  has_issue BOOLEAN NOT NULL DEFAULT false,
  issue_category TEXT NULL CHECK (issue_category IN ('venue', 'organization', 'safety', 'audio_visual', 'scheduling', 'other')),
  issue_description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_feedback_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_feedback_event ON public.event_feedback (event_id, rating);

ALTER TABLE public.event_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees can read own feedback" ON public.event_feedback;
CREATE POLICY "Attendees can read own feedback"
  ON public.event_feedback FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Registered attendees can insert feedback" ON public.event_feedback;
CREATE POLICY "Registered attendees can insert feedback"
  ON public.event_feedback FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.event_id = event_feedback.event_id
        AND r.user_id = auth.uid()
        AND r.status IN ('registered', 'checked_in')
    )
  );

DROP POLICY IF EXISTS "Attendees can update own feedback" ON public.event_feedback;
CREATE POLICY "Attendees can update own feedback"
  ON public.event_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Aggregate RPC for organizers (privacy guaranteed: zero attendee IDs exposed)
CREATE OR REPLACE FUNCTION public.get_event_feedback_aggregate(p_event_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_is_team BOOLEAN;
  v_avg_rating NUMERIC;
  v_total INTEGER;
  v_dist JSONB;
  v_comments JSONB;
  v_issues_count INTEGER;
  v_issues_dist JSONB;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is owner, editor, or viewer
  SELECT EXISTS (
    SELECT 1 FROM public.events e WHERE e.id = p_event_id AND e.organizer_id = v_caller
  ) OR EXISTS (
    SELECT 1 FROM public.event_team_members tm WHERE tm.event_id = p_event_id AND tm.user_id = v_caller AND tm.role IN ('owner', 'editor', 'viewer')
  ) INTO v_is_team;

  IF NOT v_is_team THEN
    RAISE EXCEPTION 'Not authorized to view feedback summary for this event';
  END IF;

  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0),
    COUNT(*)
  INTO v_avg_rating, v_total
  FROM public.event_feedback
  WHERE event_id = p_event_id;

  SELECT jsonb_object_agg(r::text, count)
  INTO v_dist
  FROM (
    SELECT r, COUNT(ef.rating) as count
    FROM generate_series(1, 5) AS r
    LEFT JOIN public.event_feedback ef ON ef.rating = r AND ef.event_id = p_event_id
    GROUP BY r
  ) sub;

  -- Extract recent comments WITHOUT user_id (privacy guarantee)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'rating', ef.rating,
      'feedback', ef.feedback,
      'has_issue', ef.has_issue,
      'issue_category', ef.issue_category,
      'created_at', ef.created_at
    ) ORDER BY ef.created_at DESC
  ), '[]'::jsonb)
  INTO v_comments
  FROM public.event_feedback ef
  WHERE ef.event_id = p_event_id AND (
    (ef.feedback IS NOT NULL AND trim(ef.feedback) != '')
    OR ef.has_issue = true
  );

  SELECT COUNT(*)
  INTO v_issues_count
  FROM public.event_feedback
  WHERE event_id = p_event_id AND has_issue = true;

  SELECT COALESCE(jsonb_object_agg(issue_category, count), '{}'::jsonb)
  INTO v_issues_dist
  FROM (
    SELECT issue_category, COUNT(*) as count
    FROM public.event_feedback
    WHERE event_id = p_event_id AND has_issue = true AND issue_category IS NOT NULL
    GROUP BY issue_category
  ) issues_sub;

  RETURN jsonb_build_object(
    'average_rating', v_avg_rating,
    'total_reviews', v_total,
    'distribution', COALESCE(v_dist, '{}'::jsonb),
    'recent_comments', v_comments,
    'issues_count', v_issues_count,
    'issues_by_category', v_issues_dist
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_feedback_aggregate(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_event_feedback_aggregate(UUID) TO authenticated;

-- 5. Moderation Reports & Abuse Prevention
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('event', 'organizer')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'misleading', 'safety_concern', 'fraud', 'inappropriate', 'harassment', 'other')),
  details TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'investigating', 'action_taken', 'dismissed')),
  admin_notes TEXT NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_moderation_reports_target ON public.moderation_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_status ON public.moderation_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_reporter ON public.moderation_reports(reporter_id, created_at DESC);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own moderation reports" ON public.moderation_reports;
CREATE POLICY "Users can insert own moderation reports"
  ON public.moderation_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Users can view own moderation reports" ON public.moderation_reports;
CREATE POLICY "Users can view own moderation reports"
  ON public.moderation_reports FOR SELECT
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view all moderation reports" ON public.moderation_reports;
CREATE POLICY "Admins can view all moderation reports"
  ON public.moderation_reports FOR SELECT
  USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    )
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Admins can update moderation reports" ON public.moderation_reports;
CREATE POLICY "Admins can update moderation reports"
  ON public.moderation_reports FOR UPDATE
  USING (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    )
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    (auth.jwt()->'user_metadata'->>'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role::text = 'admin'
    )
    OR auth.role() = 'service_role'
  );

-- ─── 8. Break Cross-Table RLS Recursion on Events & Team Relations ────────────

-- Fix event_team_members policies to prevent self-recursion and mutual recursion with events
DROP POLICY IF EXISTS "Team members can view their event teams" ON public.event_team_members;
CREATE POLICY "Team members can view their event teams"
  ON public.event_team_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid(), ARRAY['owner', 'editor'])
  );

DROP POLICY IF EXISTS "Event owners can manage team members" ON public.event_team_members;
CREATE POLICY "Event owners can manage team members"
  ON public.event_team_members FOR ALL
  TO authenticated
  USING (
    public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid(), ARRAY['owner'])
  );

-- Fix events policies
DROP POLICY IF EXISTS "Event team members can read own events" ON public.events;
CREATE POLICY "Event team members can read own events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    auth.uid() = organizer_id
    OR public.has_event_team_role(id, auth.uid())
  );

DROP POLICY IF EXISTS "Event owners and editors can update events" ON public.events;
CREATE POLICY "Event owners and editors can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = organizer_id AND EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_verified = true
    ))
    OR public.has_event_team_role(id, auth.uid(), ARRAY['owner', 'editor'])
  );

-- Fix registrations policies
DROP POLICY IF EXISTS "Event team members can read event registrations" ON public.registrations;
CREATE POLICY "Event team members can read event registrations"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid())
  );

DROP POLICY IF EXISTS "Event check-in staff and managers can update registration check-in" ON public.registrations;
CREATE POLICY "Event check-in staff and managers can update registration check-in"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid(), ARRAY['owner', 'editor', 'check_in_staff'])
  );

-- Fix registration_answers policy
DROP POLICY IF EXISTS "Event managers and viewers can view registration answers" ON public.registration_answers;
CREATE POLICY "Event managers and viewers can view registration answers"
  ON public.registration_answers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_answers.registration_id
        AND (
          r.user_id = auth.uid()
          OR public.is_event_organizer(r.event_id, auth.uid())
          OR public.has_event_team_role(r.event_id, auth.uid(), ARRAY['owner', 'editor', 'viewer'])
        )
    )
  );

-- Fix event_registration_questions policy
DROP POLICY IF EXISTS "Read registration questions for published events or by event team" ON public.event_registration_questions;
CREATE POLICY "Read registration questions for published events or by event team"
  ON public.event_registration_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_registration_questions.event_id AND e.status = 'published'
    )
    OR public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid())
  );

-- Fix event_announcements policy
DROP POLICY IF EXISTS "Team members can view event announcements" ON public.event_announcements;
CREATE POLICY "Team members can view event announcements"
  ON public.event_announcements FOR SELECT
  TO authenticated
  USING (
    public.is_event_organizer(event_id, auth.uid())
    OR public.has_event_team_role(event_id, auth.uid())
  );

-- Security definer helper to check if attendee belongs to organizer's events without evaluating registrations/events RLS
CREATE OR REPLACE FUNCTION public.can_organizer_read_profile(p_profile_id UUID, p_caller_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.user_id = p_profile_id
      AND e.organizer_id = p_caller_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.can_organizer_read_profile(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_organizer_read_profile(UUID, UUID) TO authenticated, service_role;

-- Fix profiles policy to prevent cross-table recursion when updating user profile / campus
DROP POLICY IF EXISTS "Organizers can read attendee profiles for own events" ON public.profiles;
CREATE POLICY "Organizers can read attendee profiles for own events"
ON public.profiles FOR SELECT
TO authenticated
USING (
  auth.uid() = id
  OR public.can_organizer_read_profile(id, auth.uid())
);


