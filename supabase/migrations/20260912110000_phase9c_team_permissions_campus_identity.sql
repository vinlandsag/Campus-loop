-- Migration: 20260912110000_phase9c_team_permissions_campus_identity.sql
-- Description: Phase 9C: Consistent event-team permissions and campus identity verification lifecycle.

-- 1. Profiles Table Expansion for Campus Verification Lifecycle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS campus_verification_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS campus_exception_reason TEXT,
  ADD COLUMN IF NOT EXISTS campus_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL;

-- Add check constraint for campus verification status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_campus_verification_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_campus_verification_status_check
      CHECK (campus_verification_status IN ('unverified', 'pending', 'verified', 'exception'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_campus_verification
  ON public.profiles (campus_id, campus_verification_status);

-- Backfill existing profiles with active campus_id as verified for continuity
UPDATE public.profiles
SET
  campus_verification_status = 'verified',
  campus_verified_at = COALESCE(campus_verified_at, now())
WHERE campus_id IS NOT NULL AND campus_verification_status = 'unverified';

-- 2. Trigger on User Signup: Email-domain matching verification lifecycle
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email_domain TEXT;
  v_campus_id UUID;
  v_role public.user_role;
  v_campus_status TEXT;
  v_verified_at TIMESTAMPTZ := NULL;
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

  -- Determine role: allow organizer if explicitly requested, otherwise default to student
  IF (new.raw_user_meta_data->>'role' = 'organizer' OR new.raw_user_meta_data->>'requested_role' = 'organizer') THEN
    v_role := 'organizer'::public.user_role;
  ELSE
    v_role := 'student'::public.user_role;
  END IF;

  -- Campus verification status:
  -- Domain-matched campus membership becomes verified only when email is confirmed
  IF new.email_confirmed_at IS NOT NULL THEN
    v_campus_status := 'verified';
    v_verified_at := clock_timestamp();
  ELSE
    v_campus_status := 'unverified';
  END IF;

  -- Crucial: is_verified (organizer approval) is ALWAYS strictly false for all new signups
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    role,
    is_verified,
    campus_id,
    campus_verification_status,
    campus_verified_at
  )
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    false,
    v_campus_id,
    v_campus_status,
    v_verified_at
  );
  RETURN new;
END;
$$;

-- 3. Prevent Organizers from Silently Moving Existing Events Across Campuses
CREATE OR REPLACE FUNCTION public.enforce_event_campus_inheritance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_campus_id UUID;
  v_organizer_status TEXT;
  v_organizer_is_verified BOOLEAN;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Fetch organizer's campus and verification status
    SELECT campus_id, campus_verification_status, is_verified
    INTO v_organizer_campus_id, v_organizer_status, v_organizer_is_verified
    FROM public.profiles
    WHERE id = NEW.organizer_id;

    IF v_organizer_campus_id IS NULL THEN
      RAISE EXCEPTION 'Organizer must belong to an active campus before creating events';
    END IF;

    -- Disallow assigning to a different campus
    IF NEW.campus_id IS NOT NULL AND NEW.campus_id <> v_organizer_campus_id THEN
      RAISE EXCEPTION 'Organizers cannot assign events to a different campus';
    END IF;

    -- Ensure event.campus_id strictly matches the organizer's campus
    NEW.campus_id := v_organizer_campus_id;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Prevent silently moving existing events across campuses
    IF OLD.campus_id IS NOT NULL AND NEW.campus_id IS NOT NULL AND NEW.campus_id <> OLD.campus_id THEN
      RAISE EXCEPTION 'Events cannot be moved to a different campus once assigned.';
    END IF;

    -- Preserve the existing campus_id if incoming is null
    IF NEW.campus_id IS NULL THEN
      NEW.campus_id := OLD.campus_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_event_campus_inheritance ON public.events;
CREATE TRIGGER trg_enforce_event_campus_inheritance
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.enforce_event_campus_inheritance();

-- 4. Unified Event Team RLS Policies on `public.events`
-- Team members (owner, editor, check_in_staff, viewer) can read their events
DROP POLICY IF EXISTS "Organizers can read own events" ON public.events;
DROP POLICY IF EXISTS "Event team members can read own events" ON public.events;

CREATE POLICY "Event team members can read own events"
ON public.events FOR SELECT
TO authenticated
USING (
  auth.uid() = organizer_id
  OR EXISTS (
    SELECT 1 FROM public.event_team_members tm
    WHERE tm.event_id = events.id AND tm.user_id = auth.uid()
  )
);

-- Owners and editors can update events
DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
DROP POLICY IF EXISTS "Event owners and editors can update events" ON public.events;

CREATE POLICY "Event owners and editors can update events"
ON public.events FOR UPDATE
TO authenticated
USING (
  (auth.uid() = organizer_id AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_verified = true
  ))
  OR EXISTS (
    SELECT 1 FROM public.event_team_members tm
    WHERE tm.event_id = events.id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'editor')
  )
);

-- 5. Unified Event Team RLS Policies on `public.registrations`
-- Team members (owner, editor, check_in_staff, viewer) can view registrations for assigned events
DROP POLICY IF EXISTS "Organizers can read registrations for own events" ON public.registrations;
DROP POLICY IF EXISTS "Event team members can read event registrations" ON public.registrations;

CREATE POLICY "Event team members can read event registrations"
ON public.registrations FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = registrations.event_id
      AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.event_team_members tm
          WHERE tm.event_id = e.id AND tm.user_id = auth.uid()
        )
      )
  )
);

-- Check-in staff, editors, and owners can update registrations (for attendance check-in)
DROP POLICY IF EXISTS "Event check-in staff and managers can update registration check-in" ON public.registrations;

CREATE POLICY "Event check-in staff and managers can update registration check-in"
ON public.registrations FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = registrations.event_id
      AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.event_team_members tm
          WHERE tm.event_id = e.id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'editor', 'check_in_staff')
        )
      )
  )
);

-- 6. Scoped RLS on `public.registration_answers` (Data minimization for check-in staff)
-- Check-in staff are excluded from reading custom registration answers; only owners, editors, and viewers can view
DROP POLICY IF EXISTS "Event staff can view registration answers" ON public.registration_answers;
DROP POLICY IF EXISTS "Event managers and viewers can view registration answers" ON public.registration_answers;

CREATE POLICY "Event managers and viewers can view registration answers"
ON public.registration_answers FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.id = registration_answers.registration_id
      AND (
        e.organizer_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.event_team_members tm
          WHERE tm.event_id = e.id
            AND tm.user_id = auth.uid()
            AND tm.role IN ('owner', 'editor', 'viewer')
        )
      )
  )
);

-- 7. Least-Privilege Grants on Functions
REVOKE EXECUTE ON FUNCTION public.enforce_event_campus_inheritance() FROM public, anon, authenticated;
