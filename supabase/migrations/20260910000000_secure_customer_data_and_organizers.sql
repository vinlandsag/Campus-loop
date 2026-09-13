-- Migration: 20260910000000_secure_customer_data_and_organizers.sql
-- Description: Phase 1 security hardening:
-- 1. Adds durable organizer verification (is_verified column on profiles)
-- 2. Protects against role and verification escalation via BEFORE UPDATE trigger
-- 3. Updates handle_new_user trigger so all new signups default to student with is_verified = false
-- 4. Restricts profiles SELECT RLS to eliminate public email exposure
-- 5. Creates safe public organizer_profiles view and organizer(events) computed relation without private fields
-- 6. Hardens register_for_event RPC to use auth.uid() and remove caller-supplied user id
-- 7. Adds authenticated DELETE RLS policy for registrations to allow safe cancellation without service-role key
-- 8. Hardens events policies to require verified organizer status

-- ─── 1. Durable Organizer Verification ──────────────────────────────────────────
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;

-- Update existing trigger to ensure new signups ALWAYS default to student and unverified
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_verified)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    'student'::user_role,
    false
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prevent authenticated and anonymous users from self-escalating role or is_verified
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
    -- If called by authenticated or anon role, forbid altering role or is_verified
    IF (auth.role() = 'authenticated' OR auth.role() = 'anon') THEN
      RAISE EXCEPTION 'Cannot modify role or verification status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS protect_profiles_role_trigger ON public.profiles;
CREATE TRIGGER protect_profiles_role_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- ─── 2. Profiles Privacy RLS ──────────────────────────────────────────────────
-- Drop the insecure policy that exposed all profiles (and emails) to everyone
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Organizers can read attendee profiles for own events" ON public.profiles;

-- Authenticated users can view only their own full profile
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Organizers can read attendee profiles for events they organize
CREATE POLICY "Organizers can read attendee profiles for own events"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.registrations r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.user_id = profiles.id
    AND e.organizer_id = auth.uid()
  )
);

-- ─── 3. Safe Public Organizer Data Path ────────────────────────────────────────
-- View containing only public safe fields for verified organizers (NO email, college, department, year, role)
CREATE OR REPLACE VIEW public.organizer_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  avatar_url,
  is_verified
FROM public.profiles
WHERE role = 'organizer' AND is_verified = true;

GRANT SELECT ON public.organizer_profiles TO anon, authenticated;

-- Computed relationship on events for PostgREST
CREATE OR REPLACE FUNCTION public.organizer(events public.events)
RETURNS public.organizer_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, is_verified
  FROM public.profiles
  WHERE id = $1.organizer_id AND role = 'organizer' AND is_verified = true;
$$;

GRANT EXECUTE ON FUNCTION public.organizer(public.events) TO anon, authenticated;

-- Helper RPC for safe public organizer profile lookups
CREATE OR REPLACE FUNCTION public.get_organizer_profile(p_organizer_id UUID)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  avatar_url TEXT,
  is_verified BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, full_name, avatar_url, is_verified
  FROM public.profiles
  WHERE id = p_organizer_id AND role = 'organizer' AND is_verified = true;
$$;

GRANT EXECUTE ON FUNCTION public.get_organizer_profile(UUID) TO anon, authenticated;

-- ─── 4. Events RLS Hardening for Verified Organizers ─────────────────────────
DROP POLICY IF EXISTS "Organizers can read own events" ON public.events;
CREATE POLICY "Organizers can read own events"
ON public.events FOR SELECT
TO authenticated
USING (
  auth.uid() = organizer_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'organizer'
    AND profiles.is_verified = true
  )
);

DROP POLICY IF EXISTS "Organizers can insert own events" ON public.events;
CREATE POLICY "Organizers can insert own events"
ON public.events FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = organizer_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'organizer'
    AND profiles.is_verified = true
  )
);

DROP POLICY IF EXISTS "Organizers can update own events" ON public.events;
CREATE POLICY "Organizers can update own events"
ON public.events FOR UPDATE
TO authenticated
USING (
  auth.uid() = organizer_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'organizer'
    AND profiles.is_verified = true
  )
);

DROP POLICY IF EXISTS "Organizers can delete own events" ON public.events;
CREATE POLICY "Organizers can delete own events"
ON public.events FOR DELETE
TO authenticated
USING (
  auth.uid() = organizer_id AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'organizer'
    AND profiles.is_verified = true
  )
);

-- ─── 5. Hardened Registration RPC ───────────────────────────────────────────
-- Drop legacy 2-argument function
DROP FUNCTION IF EXISTS public.register_for_event(UUID, UUID);

-- Create hardened single-argument RPC using auth.uid()
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_capacity INT;
  v_current_registrations INT;
  v_status event_status;
BEGIN
  -- 1. Ensure user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to register';
  END IF;

  -- 2. Lock event row for update to prevent concurrent capacity race conditions
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  -- 3. Validate event existence
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 4. Validate event status
  IF v_status != 'published' THEN
    RAISE EXCEPTION 'Event is not published (current status: %)', v_status;
  END IF;

  -- 5. Check capacity (if not null)
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_registrations
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'registered';

    IF v_current_registrations >= v_capacity THEN
      RAISE EXCEPTION 'Event is at full capacity';
    END IF;
  END IF;

  -- 6. Insert registration for the authenticated user only
  INSERT INTO public.registrations (event_id, user_id, status)
  VALUES (p_event_id, v_user_id, 'registered');

  RETURN json_build_object('success', true, 'message', 'Successfully registered');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'User is already registered for this event';
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID) TO authenticated;

-- ─── 6. Safe Cancellation via Authenticated DELETE RLS ─────────────────────────
DROP POLICY IF EXISTS "Users can delete own registrations" ON public.registrations;
CREATE POLICY "Users can delete own registrations"
ON public.registrations FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
