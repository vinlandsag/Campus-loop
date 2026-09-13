-- Migration: 20260912190000_phase16_account_center_settings.sql
-- Description: Phase 16: Customer-grade settings, security audit logs, account deletion workflow,
-- organizer workspace defaults, quiet hours, in-app notification preferences, and public-field masking.

-- 1. Security Audit Logs Table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own security audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own security audit logs"
  ON public.security_audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user
  ON public.security_audit_logs(user_id, created_at DESC);

-- 2. Account Deletion Requests Table
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled', 'completed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own deletion requests"
  ON public.account_deletion_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deletion requests"
  ON public.account_deletion_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deletion requests"
  ON public.account_deletion_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_account_deletion_scheduled
  ON public.account_deletion_requests(status, scheduled_for);

-- 3. Organizer Workspace Settings Table
CREATE TABLE IF NOT EXISTS public.organizer_workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_timezone TEXT NOT NULL DEFAULT 'UTC',
  default_venue_id UUID REFERENCES public.campus_venues(id) ON DELETE SET NULL,
  default_category TEXT NOT NULL DEFAULT 'Academic',
  default_accessibility_statement TEXT,
  default_contact_email TEXT,
  notify_on_new_registration BOOLEAN NOT NULL DEFAULT true,
  notify_on_volunteer_application BOOLEAN NOT NULL DEFAULT true,
  notify_on_event_feedback BOOLEAN NOT NULL DEFAULT true,
  default_team_invites_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizer_workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizers can view own workspace settings"
  ON public.organizer_workspace_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = organizer_id);

CREATE POLICY "Organizers can insert own workspace settings"
  ON public.organizer_workspace_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own workspace settings"
  ON public.organizer_workspace_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = organizer_id);

-- 4. Extend user_notification_preferences
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registration_confirmations_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS registration_confirmations_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminders_24h_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS reminders_1h_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_updates_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS waitlist_promotions_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followed_clubs_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS followed_clubs_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS friend_activity_email BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS friend_activity_in_app BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start TEXT DEFAULT '22:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS delivery_timezone TEXT DEFAULT 'UTC';

-- 5. Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_name TEXT,
  ADD COLUMN IF NOT EXISTS public_fields_visibility JSONB DEFAULT '{"bio":true,"website":true,"instagram":true,"contact_email":true,"college":true,"department":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false;

-- 6. Update organizer_profiles safe public view with dynamic masking
CREATE OR REPLACE VIEW public.organizer_profiles WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  avatar_url,
  is_verified,
  campus_id,
  CASE WHEN (COALESCE(public_fields_visibility->>'bio', 'true'))::boolean THEN bio ELSE NULL END AS bio,
  CASE WHEN (COALESCE(public_fields_visibility->>'website', 'true'))::boolean THEN website_url ELSE NULL END AS website_url,
  CASE WHEN (COALESCE(public_fields_visibility->>'instagram', 'true'))::boolean THEN instagram_handle ELSE NULL END AS instagram_handle,
  CASE WHEN (COALESCE(public_fields_visibility->>'contact_email', 'true'))::boolean THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN (COALESCE(public_fields_visibility->>'college', 'true'))::boolean THEN college ELSE NULL END AS college,
  CASE WHEN (COALESCE(public_fields_visibility->>'department', 'true'))::boolean THEN department ELSE NULL END AS department
FROM public.profiles
WHERE role = 'organizer';

GRANT SELECT ON public.organizer_profiles TO public;
