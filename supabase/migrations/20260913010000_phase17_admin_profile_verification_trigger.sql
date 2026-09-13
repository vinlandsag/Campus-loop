-- Migration: 20260913010000_phase17_admin_profile_verification_trigger.sql
-- Description: Allow system administrators to modify role and verification status on profiles

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role OR OLD.is_verified IS DISTINCT FROM NEW.is_verified) THEN
    -- Forbid altering role or is_verified unless caller is a system administrator or service_role
    IF (auth.role() = 'authenticated' OR auth.role() = 'anon') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Cannot modify role or verification status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
