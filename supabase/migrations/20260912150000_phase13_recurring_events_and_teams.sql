-- Migration: 20260912150000_phase13_recurring_events_and_teams.sql
-- Description: Phase 13: Recurring events, event series, and attendee group/team registration

-- 1. Create event_series table
CREATE TABLE IF NOT EXISTS public.event_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  campus_id UUID REFERENCES public.campuses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('weekly', 'monthly', 'custom')),
  interval_value INT NOT NULL DEFAULT 1,
  days_of_week INT[] DEFAULT NULL, -- 0=Sun, 1=Mon, ..., 6=Sat
  end_type TEXT NOT NULL CHECK (end_type IN ('date', 'count')),
  end_date DATE,
  occurrence_count INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Extend events table for series and team registration
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES public.event_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_sequence_index INT,
  ADD COLUMN IF NOT EXISTS is_series_override BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS registration_mode TEXT NOT NULL DEFAULT 'individual' CHECK (registration_mode IN ('individual', 'team', 'both')),
  ADD COLUMN IF NOT EXISTS min_team_size INT DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_team_size INT DEFAULT 4,
  ADD COLUMN IF NOT EXISTS max_teams INT DEFAULT NULL;

-- 3. Create attendee group / team registration tables
CREATE TABLE IF NOT EXISTS public.event_registration_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'forming' CHECK (status IN ('forming', 'complete', 'disbanded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_team_event_name UNIQUE (event_id, name)
);

CREATE TABLE IF NOT EXISTS public.event_registration_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.event_registration_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  registration_id UUID REFERENCES public.registrations(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_event_team UNIQUE (event_id, user_id),
  CONSTRAINT uq_team_member UNIQUE (team_id, user_id)
);

-- 4. Extend registrations table with team_id
ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.event_registration_teams(id) ON DELETE SET NULL;

-- 5. Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_events_series_id ON public.events(series_id);
CREATE INDEX IF NOT EXISTS idx_event_series_slug ON public.event_series(slug);
CREATE INDEX IF NOT EXISTS idx_event_series_organizer ON public.event_series(organizer_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_teams_event ON public.event_registration_teams(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_teams_invite ON public.event_registration_teams(invite_code);
CREATE INDEX IF NOT EXISTS idx_event_reg_team_members_team ON public.event_registration_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_event_reg_team_members_user ON public.event_registration_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_team_id ON public.registrations(team_id);

-- 6. Enable RLS
ALTER TABLE public.event_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registration_team_members ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for event_series
DROP POLICY IF EXISTS "Public can view event series" ON public.event_series;
CREATE POLICY "Public can view event series"
  ON public.event_series FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Organizers can create event series" ON public.event_series;
CREATE POLICY "Organizers can create event series"
  ON public.event_series FOR INSERT
  WITH CHECK (
    auth.uid() = organizer_id
  );

DROP POLICY IF EXISTS "Organizers can update own event series" ON public.event_series;
CREATE POLICY "Organizers can update own event series"
  ON public.event_series FOR UPDATE
  USING (
    auth.uid() = organizer_id
  );

DROP POLICY IF EXISTS "Organizers can delete own event series" ON public.event_series;
CREATE POLICY "Organizers can delete own event series"
  ON public.event_series FOR DELETE
  USING (
    auth.uid() = organizer_id
  );

-- 8. RLS Policies for event_registration_teams
DROP POLICY IF EXISTS "Public can view teams for events" ON public.event_registration_teams;
CREATE POLICY "Public can view teams for events"
  ON public.event_registration_teams FOR SELECT
  USING (status != 'disbanded');

DROP POLICY IF EXISTS "Authenticated users can create teams" ON public.event_registration_teams;
CREATE POLICY "Authenticated users can create teams"
  ON public.event_registration_teams FOR INSERT
  WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Leaders can update their team" ON public.event_registration_teams;
CREATE POLICY "Leaders can update their team"
  ON public.event_registration_teams FOR UPDATE
  USING (auth.uid() = leader_id);

-- 9. RLS Policies for event_registration_team_members
DROP POLICY IF EXISTS "Public can view team members" ON public.event_registration_team_members;
CREATE POLICY "Public can view team members"
  ON public.event_registration_team_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own team membership" ON public.event_registration_team_members;
CREATE POLICY "Users can insert their own team membership"
  ON public.event_registration_team_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove themselves from a team" ON public.event_registration_team_members;
CREATE POLICY "Users can remove themselves from a team"
  ON public.event_registration_team_members FOR DELETE
  USING (auth.uid() = user_id);

-- 10. Atomic RPC: create_registration_team
CREATE OR REPLACE FUNCTION public.create_registration_team(
  p_event_id UUID,
  p_team_name TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_team_id UUID;
  v_invite_code TEXT;
  v_team_count INT;
  v_cleaned_name TEXT;
  v_active_regs INT;
  v_min_size INT;
  v_max_size INT;
  v_initial_status TEXT;
  v_member_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be logged in to create a team');
  END IF;

  v_cleaned_name := trim(p_team_name);
  IF length(v_cleaned_name) < 2 OR length(v_cleaned_name) > 60 THEN
    RETURN json_build_object('success', false, 'error', 'Team name must be between 2 and 60 characters');
  END IF;

  -- Lock event row for atomic validation
  SELECT id, title, slug, status, capacity, active_registrations_count, registration_mode, min_team_size, max_team_size, max_teams, registration_deadline
  INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF v_event.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'This event has been cancelled');
  END IF;

  IF v_event.registration_mode = 'individual' THEN
    RETURN json_build_object('success', false, 'error', 'This event does not allow team registration');
  END IF;

  IF v_event.registration_deadline IS NOT NULL AND NOW() > v_event.registration_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Registration deadline has passed');
  END IF;

  -- Check if user is already in a team for this event
  IF EXISTS (
    SELECT 1 FROM public.event_registration_team_members
    WHERE event_id = p_event_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are already in a team for this event');
  END IF;

  -- Check team limit if max_teams is specified
  IF v_event.max_teams IS NOT NULL THEN
    SELECT COUNT(*)::INT INTO v_team_count
    FROM public.event_registration_teams
    WHERE event_id = p_event_id AND status != 'disbanded';

    IF v_team_count >= v_event.max_teams THEN
      RETURN json_build_object('success', false, 'error', 'Maximum number of teams reached for this event');
    END IF;
  END IF;

  v_min_size := COALESCE(v_event.min_team_size, 2);
  v_max_size := COALESCE(v_event.max_team_size, 4);

  -- Check event capacity for at least min_team_size
  IF v_event.capacity IS NOT NULL THEN
    v_active_regs := COALESCE(v_event.active_registrations_count, 0);
    IF (v_active_regs + v_min_size) > v_event.capacity THEN
      RETURN json_build_object('success', false, 'error', 'Not enough capacity remaining to form a new team');
    END IF;
  END IF;

  -- Check duplicate team name in event
  IF EXISTS (
    SELECT 1 FROM public.event_registration_teams
    WHERE event_id = p_event_id AND lower(name) = lower(v_cleaned_name) AND status != 'disbanded'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'A team with this name already exists in this event');
  END IF;

  -- Generate unguessable invite code (10 alphanumeric characters)
  v_invite_code := upper(encode(gen_random_bytes(5), 'hex'));

  -- If min_team_size is 1, team is immediately complete
  IF v_min_size <= 1 THEN
    v_initial_status := 'complete';
    v_member_status := 'confirmed';
  ELSE
    v_initial_status := 'forming';
    v_member_status := 'pending';
  END IF;

  -- Insert team
  INSERT INTO public.event_registration_teams (
    event_id,
    name,
    leader_id,
    invite_code,
    status
  ) VALUES (
    p_event_id,
    v_cleaned_name,
    v_user_id,
    v_invite_code,
    v_initial_status
  ) RETURNING id INTO v_team_id;

  -- Insert creator as leader
  INSERT INTO public.event_registration_team_members (
    team_id,
    user_id,
    event_id,
    role,
    status
  ) VALUES (
    v_team_id,
    v_user_id,
    p_event_id,
    'leader',
    v_member_status
  );

  RETURN json_build_object(
    'success', true,
    'team_id', v_team_id,
    'team_name', v_cleaned_name,
    'invite_code', v_invite_code,
    'status', v_initial_status,
    'min_team_size', v_min_size,
    'max_team_size', v_max_size
  );
END;
$$;

-- 11. Atomic RPC: join_registration_team
CREATE OR REPLACE FUNCTION public.join_registration_team(
  p_invite_code TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_code TEXT;
  v_team RECORD;
  v_event RECORD;
  v_member_count INT;
  v_active_regs INT;
  v_min_size INT;
  v_max_size INT;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be logged in to join a team');
  END IF;

  v_code := upper(trim(p_invite_code));
  IF length(v_code) < 6 THEN
    RETURN json_build_object('success', false, 'error', 'Invalid invite code format');
  END IF;

  -- Lock team row
  SELECT id, event_id, name, leader_id, invite_code, status
  INTO v_team
  FROM public.event_registration_teams
  WHERE invite_code = v_code
  FOR UPDATE;

  IF NOT FOUND OR v_team.status = 'disbanded' THEN
    RETURN json_build_object('success', false, 'error', 'Team not found or invite code expired');
  END IF;

  -- Lock event row
  SELECT id, title, slug, status, capacity, active_registrations_count, min_team_size, max_team_size, registration_deadline
  INTO v_event
  FROM public.events
  WHERE id = v_team.event_id
  FOR UPDATE;

  IF v_event.status = 'cancelled' THEN
    RETURN json_build_object('success', false, 'error', 'This event has been cancelled');
  END IF;

  IF v_event.registration_deadline IS NOT NULL AND NOW() > v_event.registration_deadline THEN
    RETURN json_build_object('success', false, 'error', 'Registration deadline has passed');
  END IF;

  -- Check if user is already on a team for this event
  IF EXISTS (
    SELECT 1 FROM public.event_registration_team_members
    WHERE event_id = v_team.event_id AND user_id = v_user_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are already in a team for this event');
  END IF;

  -- Current team size check
  SELECT COUNT(*)::INT INTO v_member_count
  FROM public.event_registration_team_members
  WHERE team_id = v_team.id;

  v_max_size := COALESCE(v_event.max_team_size, 4);
  v_min_size := COALESCE(v_event.min_team_size, 2);

  IF v_member_count >= v_max_size THEN
    RETURN json_build_object('success', false, 'error', 'This team has already reached maximum capacity');
  END IF;

  -- Capacity check on event level
  IF v_event.capacity IS NOT NULL THEN
    v_active_regs := COALESCE(v_event.active_registrations_count, 0);
    IF v_active_regs >= v_event.capacity THEN
      RETURN json_build_object('success', false, 'error', 'Event capacity is fully exhausted');
    END IF;
  END IF;

  -- Insert member
  INSERT INTO public.event_registration_team_members (
    team_id,
    user_id,
    event_id,
    role,
    status
  ) VALUES (
    v_team.id,
    v_user_id,
    v_team.event_id,
    'member',
    'pending'
  );

  v_member_count := v_member_count + 1;

  -- Check if team now meets min_team_size requirement
  IF v_member_count >= v_min_size THEN
    v_new_status := 'complete';
    UPDATE public.event_registration_teams
    SET status = 'complete', updated_at = NOW()
    WHERE id = v_team.id;

    UPDATE public.event_registration_team_members
    SET status = 'confirmed'
    WHERE team_id = v_team.id;
  ELSE
    v_new_status := 'forming';
  END IF;

  RETURN json_build_object(
    'success', true,
    'team_id', v_team.id,
    'team_name', v_team.name,
    'status', v_new_status,
    'member_count', v_member_count,
    'min_team_size', v_min_size,
    'max_team_size', v_max_size
  );
END;
$$;

-- 12. Atomic RPC: leave_registration_team
CREATE OR REPLACE FUNCTION public.leave_registration_team(
  p_team_id UUID
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_team RECORD;
  v_member RECORD;
  v_other_member RECORD;
  v_remaining_count INT;
  v_min_size INT;
  v_event RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be logged in to leave a team');
  END IF;

  -- Lock team row
  SELECT id, event_id, name, leader_id, status
  INTO v_team
  FROM public.event_registration_teams
  WHERE id = p_team_id
  FOR UPDATE;

  IF NOT FOUND OR v_team.status = 'disbanded' THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check membership
  SELECT id, role, registration_id
  INTO v_member
  FROM public.event_registration_team_members
  WHERE team_id = p_team_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this team');
  END IF;

  -- Remove this member
  DELETE FROM public.event_registration_team_members
  WHERE id = v_member.id;

  -- Cancel their registration if created
  IF v_member.registration_id IS NOT NULL THEN
    UPDATE public.registrations
    SET status = 'cancelled'
    WHERE id = v_member.registration_id;
  END IF;

  -- Check remaining count
  SELECT COUNT(*)::INT INTO v_remaining_count
  FROM public.event_registration_team_members
  WHERE team_id = p_team_id;

  IF v_remaining_count = 0 THEN
    -- Disband empty team
    UPDATE public.event_registration_teams
    SET status = 'disbanded', updated_at = NOW()
    WHERE id = p_team_id;

    RETURN json_build_object('success', true, 'action', 'disbanded');
  END IF;

  -- If the leaving user was the leader, transfer leadership to next member
  IF v_team.leader_id = v_user_id THEN
    SELECT id, user_id INTO v_other_member
    FROM public.event_registration_team_members
    WHERE team_id = p_team_id
    ORDER BY joined_at ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE public.event_registration_teams
      SET leader_id = v_other_member.user_id, updated_at = NOW()
      WHERE id = p_team_id;

      UPDATE public.event_registration_team_members
      SET role = 'leader'
      WHERE id = v_other_member.id;
    END IF;
  END IF;

  -- Check min_team_size
  SELECT min_team_size INTO v_min_size
  FROM public.events
  WHERE id = v_team.event_id;

  v_min_size := COALESCE(v_min_size, 2);

  IF v_remaining_count < v_min_size THEN
    UPDATE public.event_registration_teams
    SET status = 'forming', updated_at = NOW()
    WHERE id = p_team_id;

    UPDATE public.event_registration_team_members
    SET status = 'pending'
    WHERE team_id = p_team_id;
  END IF;

  RETURN json_build_object('success', true, 'action', 'left', 'remaining_members', v_remaining_count);
END;
$$;
