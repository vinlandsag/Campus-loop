-- Migration: 20260913020000_phase17_campus_domain_verification_trigger.sql
-- Description: Automatically sync campus verification for users when email domain matches approved campus domains

-- Function to auto-verify users when campus approved domains are updated
CREATE OR REPLACE FUNCTION public.sync_campus_domain_verifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.approved_domains IS DISTINCT FROM OLD.approved_domains THEN
    -- Update all unverified users on this campus whose email domain matches any of the new approved_domains
    UPDATE public.profiles
    SET 
      campus_verification_status = 'verified',
      campus_verified_at = clock_timestamp()
    WHERE campus_id = NEW.id
      AND campus_verification_status <> 'verified'
      AND split_part(email, '@', 2) = ANY(NEW.approved_domains);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_campus_domain_verifications ON public.campuses;
CREATE TRIGGER trg_sync_campus_domain_verifications
AFTER UPDATE OF approved_domains ON public.campuses
FOR EACH ROW EXECUTE FUNCTION public.sync_campus_domain_verifications();

-- Also update handle_new_user so that domain-matched signups get verified immediately
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
  -- If domain matches an active approved campus domain, auto-verify!
  IF EXISTS (
    SELECT 1 FROM public.campuses
    WHERE id = v_campus_id AND is_active = true AND v_email_domain = ANY(approved_domains)
  ) THEN
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
