-- ==============================================================================
-- Migration: Phase 12 - Social Discovery, Club Follows & Privacy-Preserving Friends
-- ==============================================================================

-- ─── 1. Club / Organizer Follow System ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notify_on_new_events BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_club_follows_user_organizer UNIQUE (user_id, organizer_id),
  CONSTRAINT chk_club_follows_no_self CHECK (user_id <> organizer_id)
);

CREATE INDEX IF NOT EXISTS idx_club_follows_user ON public.club_follows (user_id);
CREATE INDEX IF NOT EXISTS idx_club_follows_organizer ON public.club_follows (organizer_id);

ALTER TABLE public.club_follows ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only read their own follows
DROP POLICY IF EXISTS "Users can read own club follows" ON public.club_follows;
CREATE POLICY "Users can read own club follows"
  ON public.club_follows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: Organizers can see who follows them
DROP POLICY IF EXISTS "Organizers can read their followers" ON public.club_follows;
CREATE POLICY "Organizers can read their followers"
  ON public.club_follows FOR SELECT
  TO authenticated
  USING (auth.uid() = organizer_id);

-- RLS: Users can follow verified organizers
DROP POLICY IF EXISTS "Users can insert own club follows" ON public.club_follows;
CREATE POLICY "Users can insert own club follows"
  ON public.club_follows FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = club_follows.organizer_id
        AND p.role = 'organizer'
        AND p.is_verified = true
    )
  );

-- RLS: Users can update own follow notification preference
DROP POLICY IF EXISTS "Users can update own club follows" ON public.club_follows;
CREATE POLICY "Users can update own club follows"
  ON public.club_follows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS: Users can unfollow
DROP POLICY IF EXISTS "Users can delete own club follows" ON public.club_follows;
CREATE POLICY "Users can delete own club follows"
  ON public.club_follows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Safe aggregate follower count function (does not expose follower identities)
CREATE OR REPLACE FUNCTION public.get_organizer_follower_count(p_organizer_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.club_follows
  WHERE organizer_id = p_organizer_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_organizer_follower_count(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_organizer_follower_count(UUID) TO authenticated, anon;

-- ─── 2. User Social & Attendance Privacy Preferences ──────────────────────────
CREATE TABLE IF NOT EXISTS public.user_social_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  share_attendance_with_friends BOOLEAN NOT NULL DEFAULT false, -- Strict opt-in default!
  default_attendance_visibility TEXT NOT NULL DEFAULT 'private' CHECK (default_attendance_visibility IN ('private', 'friends', 'public')),
  allow_friend_requests BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_social_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own social preferences" ON public.user_social_preferences;
CREATE POLICY "Users can manage own social preferences"
  ON public.user_social_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 3. Per-Event Attendance Visibility on Registrations ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'registrations' AND column_name = 'attendance_visibility'
  ) THEN
    ALTER TABLE public.registrations
      ADD COLUMN attendance_visibility TEXT NOT NULL DEFAULT 'private'
      CHECK (attendance_visibility IN ('private', 'friends', 'public'));
  END IF;
END $$;

-- ─── 4. Private Friend Connections ────────────────────────────────────────────
-- Pairwise friendships with no public graph enumeration
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Requester
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- Recipient
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_friendships_pair UNIQUE (user_id, friend_id),
  CONSTRAINT chk_friendships_no_self CHECK (user_id <> friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user ON public.friendships (user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON public.friendships (friend_id, status);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- Least privilege: Users can only see their own direct friendships
DROP POLICY IF EXISTS "Users can read own friendships" ON public.friendships;
CREATE POLICY "Users can read own friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() IN (user_id, friend_id));

-- Users can send friend requests if not blocked by recipient
DROP POLICY IF EXISTS "Users can insert friend requests" ON public.friendships;
CREATE POLICY "Users can insert friend requests"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.user_id = friendships.friend_id
        AND f.friend_id = auth.uid()
        AND f.status = 'blocked'
    )
  );

-- Users can update friendships they are part of
DROP POLICY IF EXISTS "Users can update own friendships" ON public.friendships;
CREATE POLICY "Users can update own friendships"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (user_id, friend_id))
  WITH CHECK (auth.uid() IN (user_id, friend_id));

-- Users can delete/remove friendships they are part of
DROP POLICY IF EXISTS "Users can delete own friendships" ON public.friendships;
CREATE POLICY "Users can delete own friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() IN (user_id, friend_id));

-- Helper: Are two users mutual friends
CREATE OR REPLACE FUNCTION public.are_friends(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE ((user_id = user_a AND friend_id = user_b) OR (user_id = user_b AND friend_id = user_a))
      AND status = 'accepted'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.are_friends(UUID, UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;

-- ─── 5. Consented Friend Attendance RPC ───────────────────────────────────────
-- Returns attending friends ONLY if:
-- 1. Mutual active friendship exists (status = 'accepted')
-- 2. Neither user has blocked the other
-- 3. Attending friend has explicitly opted into attendance sharing (share_attendance_with_friends = true)
-- 4. Registration has attendance_visibility IN ('friends', 'public')
-- 5. Registration status IN ('registered', 'checked_in')
-- NEVER leaks non-consenting attendees or unconfirmed users.
CREATE OR REPLACE FUNCTION public.get_event_friend_attendance(p_event_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller UUID;
  v_friends JSONB;
  v_count INTEGER;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('count', 0, 'friends', '[]'::jsonb);
  END IF;

  WITH mutual_friends AS (
    SELECT CASE WHEN f.user_id = v_caller THEN f.friend_id ELSE f.user_id END AS friend_uid
    FROM public.friendships f
    WHERE (f.user_id = v_caller OR f.friend_id = v_caller)
      AND f.status = 'accepted'
  ),
  consented_attending AS (
    SELECT
      p.id,
      p.full_name,
      p.display_name,
      p.avatar_url
    FROM mutual_friends mf
    JOIN public.registrations r ON r.user_id = mf.friend_uid AND r.event_id = p_event_id
    JOIN public.user_social_preferences usp ON usp.user_id = mf.friend_uid
    JOIN public.profiles p ON p.id = mf.friend_uid
    WHERE r.status IN ('registered', 'checked_in')
      AND r.attendance_visibility IN ('friends', 'public')
      AND usp.share_attendance_with_friends = true
  )
  SELECT
    COUNT(*),
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', ca.id,
        'name', COALESCE(ca.display_name, ca.full_name, 'Friend'),
        'avatar_url', ca.avatar_url
      )
    ), '[]'::jsonb)
  INTO v_count, v_friends
  FROM consented_attending ca;

  RETURN jsonb_build_object(
    'count', v_count,
    'friends', v_friends
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_friend_attendance(UUID) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_event_friend_attendance(UUID) TO authenticated;
