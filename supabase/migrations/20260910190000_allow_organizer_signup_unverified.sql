-- Migration: 20260910190000_allow_organizer_signup_unverified.sql
-- Description: Allows users to choose the organizer role during signup in an unverified state.
-- Preserves Phase 1 security: is_verified is always false, so new organizer signups cannot access
-- dashboard tools or publish events until approved by an administrator.

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

  -- Crucial: is_verified is ALWAYS strictly false for all new signups
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, is_verified, campus_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url',
    v_role,
    false,
    v_campus_id
  );
  RETURN new;
END;
$$;
