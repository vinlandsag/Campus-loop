-- Migration: 20260912160000_fix_club_follows_organizer_rls.sql
-- Description: Allow authenticated students to follow verified campus clubs by evaluating organizer verification via security definer function.

-- 1. Helper Security Definer function to check if an organizer is verified without exposing private profile rows
CREATE OR REPLACE FUNCTION public.is_verified_organizer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role = 'organizer' AND is_verified = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_verified_organizer(UUID) TO anon, authenticated;

-- 2. Update RLS policy on club_follows to use is_verified_organizer
DROP POLICY IF EXISTS "Users can insert own club follows" ON public.club_follows;
CREATE POLICY "Users can insert own club follows"
  ON public.club_follows FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_verified_organizer(organizer_id)
  );
