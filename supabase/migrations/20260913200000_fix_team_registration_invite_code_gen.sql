-- Migration: Fix create_registration_team invite code generation
-- Replaces pgcrypto gen_random_bytes(5) with built-in gen_random_uuid()
-- Reason: SECURITY DEFINER with search_path = public fails to resolve gen_random_bytes when pgcrypto is in extensions schema.
-- gen_random_uuid() is built-in to PostgreSQL core and guaranteed to be available in any search_path.

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

  -- Generate unguessable invite code (10 alphanumeric characters) using built-in gen_random_uuid
  v_invite_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 10));

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
