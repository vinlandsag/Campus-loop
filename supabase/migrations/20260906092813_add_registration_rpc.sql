-- Create an atomic RPC for event registration to prevent capacity race conditions
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID, p_user_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_capacity INT;
  v_current_registrations INT;
  v_status event_status;
BEGIN
  -- 1. Lock the event row for update to prevent concurrent race conditions
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  -- 2. Validate event existence
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 3. Validate event status
  IF v_status != 'published' THEN
    RAISE EXCEPTION 'Event is not published (current status: %)', v_status;
  END IF;

  -- 4. Check capacity (if not null)
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current_registrations
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'registered';

    IF v_current_registrations >= v_capacity THEN
      RAISE EXCEPTION 'Event is at full capacity';
    END IF;
  END IF;

  -- 5. Insert registration (this will fail if UNIQUE(event_id, user_id) is violated)
  INSERT INTO public.registrations (event_id, user_id, status)
  VALUES (p_event_id, p_user_id, 'registered');

  RETURN json_build_object('success', true, 'message', 'Successfully registered');
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'User is already registered for this event';
  WHEN OTHERS THEN
    RAISE;
END;
$$;
