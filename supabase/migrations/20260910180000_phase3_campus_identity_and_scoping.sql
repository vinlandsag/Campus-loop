-- Migration: 20260910180000_phase3_campus_identity_and_scoping.sql
-- Purpose: Add campus model, user and event campus associations, campus inheritance trigger, and domain matching

-- 1. Create campuses table
CREATE TABLE IF NOT EXISTS public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  approved_domains TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campuses updated_at trigger
DROP TRIGGER IF EXISTS set_campuses_updated_at ON public.campuses;
CREATE TRIGGER set_campuses_updated_at
BEFORE UPDATE ON public.campuses
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS on campuses
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active campuses" ON public.campuses;
CREATE POLICY "Anyone can read active campuses"
ON public.campuses FOR SELECT
USING (is_active = true);

-- 2. Seed initial active campuses
INSERT INTO public.campuses (id, name, slug, approved_domains, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'CampusLoop Demo Campus', 'demo-campus', ARRAY['example.com', 'campusloop.edu', 'gmail.com'], true),
  ('c0000000-0000-0000-0000-000000000002', 'University of California, Berkeley', 'uc-berkeley', ARRAY['berkeley.edu'], true),
  ('c0000000-0000-0000-0000-000000000003', 'Stanford University', 'stanford', ARRAY['stanford.edu'], true),
  ('c0000000-0000-0000-0000-000000000004', 'Massachusetts Institute of Technology', 'mit', ARRAY['mit.edu'], true),
  ('c0000000-0000-0000-0000-000000000005', 'New York University', 'nyu', ARRAY['nyu.edu'], true)
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  approved_domains = EXCLUDED.approved_domains,
  is_active = EXCLUDED.is_active;

-- 3. Add campus_id to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_campus_id ON public.profiles(campus_id);

-- Backfill profiles that have no campus_id with Demo Campus
UPDATE public.profiles
SET campus_id = 'c0000000-0000-0000-0000-000000000001'
WHERE campus_id IS NULL;

-- 4. Add campus_id to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_campus_id ON public.events(campus_id);

-- Backfill events that have no campus_id with the organizer's campus_id or Demo Campus
UPDATE public.events e
SET campus_id = COALESCE(
  (SELECT p.campus_id FROM public.profiles p WHERE p.id = e.organizer_id),
  'c0000000-0000-0000-0000-000000000001'
)
WHERE e.campus_id IS NULL;

-- 5. Enforce event campus inheritance and cross-campus prevention
CREATE OR REPLACE FUNCTION public.enforce_event_campus_inheritance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_campus_id UUID;
BEGIN
  -- Fetch organizer's campus
  SELECT campus_id INTO v_organizer_campus_id
  FROM public.profiles
  WHERE id = NEW.organizer_id;

  IF v_organizer_campus_id IS NULL THEN
    RAISE EXCEPTION 'Organizer must belong to an active campus before creating or updating events';
  END IF;

  -- Disallow assigning to a different campus
  IF NEW.campus_id IS NOT NULL AND NEW.campus_id <> v_organizer_campus_id THEN
    RAISE EXCEPTION 'Organizers cannot assign events to a different campus';
  END IF;

  -- Ensure event.campus_id strictly matches the organizer's campus
  NEW.campus_id := v_organizer_campus_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_campus_inheritance ON public.events;
CREATE TRIGGER trg_enforce_event_campus_inheritance
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_campus_inheritance();

-- 6. Update handle_new_user() trigger function to detect campus by email domain
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_domain TEXT;
  v_campus_id UUID;
BEGIN
  -- Extract domain after @
  v_email_domain := split_part(new.email, '@', 2);

  -- Check if domain matches an approved campus domain
  IF v_email_domain IS NOT NULL AND v_email_domain <> '' THEN
    SELECT id INTO v_campus_id
    FROM public.campuses
    WHERE is_active = true AND v_email_domain = ANY(approved_domains)
    LIMIT 1;
  END IF;

  -- Fallback to metadata campus_id if provided
  IF v_campus_id IS NULL AND new.raw_user_meta_data->>'campus_id' IS NOT NULL THEN
    BEGIN
      v_campus_id := (new.raw_user_meta_data->>'campus_id')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_campus_id := NULL;
    END;
  END IF;

  -- Fallback to demo campus
  IF v_campus_id IS NULL THEN
    v_campus_id := 'c0000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_verified, campus_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    'student',
    false,
    v_campus_id
  );
  RETURN new;
END;
$$;

-- 7. Update organizer_profiles safe view to include campus_id
CREATE OR REPLACE VIEW public.organizer_profiles WITH (security_invoker = false) AS
SELECT id, full_name, avatar_url, is_verified, campus_id
FROM public.profiles
WHERE role = 'organizer';

GRANT SELECT ON public.organizer_profiles TO public;
