-- Migration: 20260911000000_phase7_discovery_profiles_event_details.sql
-- Description: Phase 7 schema improvements: student decision-making fields (agenda, speakers, eligibility, deadline, what to bring, contact, accessibility, map) and club/organizer profile enhancements.

-- 1. Extend events table with student decision-making columns
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS agenda JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS speakers JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS eligibility TEXT NULL,
  ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS what_to_bring TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_method TEXT NULL,
  ADD COLUMN IF NOT EXISTS accessibility_notes TEXT NULL,
  ADD COLUMN IF NOT EXISTS map_url TEXT NULL;

-- 2. Extend profiles table with organizer/club presentation columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio TEXT NULL,
  ADD COLUMN IF NOT EXISTS website_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT NULL,
  ADD COLUMN IF NOT EXISTS contact_email TEXT NULL;

-- 3. Update organizer_profiles safe public view to include new presentation columns
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
  contact_email,
  college,
  department
FROM public.profiles
WHERE role = 'organizer';

GRANT SELECT ON public.organizer_profiles TO public;

-- 4. Performance Indexes for Discovery and Profiles
CREATE INDEX IF NOT EXISTS idx_events_discovery_date_status
  ON public.events (status, event_date ASC, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_events_organizer_date
  ON public.events (organizer_id, status, event_date DESC);
