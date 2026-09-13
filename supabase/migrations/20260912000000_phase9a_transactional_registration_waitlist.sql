-- Migration: 20260912000000_phase9a_transactional_registration_waitlist.sql
-- Description: Phase 9A: Transactional registration, atomic waitlist FIFO ordering, checked-in capacity accounting, durable deadline enforcement, and single-promotion cancellation.

-- 1. Update sync_event_active_registrations trigger to count BOTH registered and checked_in
CREATE OR REPLACE FUNCTION public.sync_event_active_registrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('registered', 'checked_in') THEN
      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = NEW.event_id AND status IN ('registered', 'checked_in')
      )
      WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status OR OLD.event_id IS DISTINCT FROM NEW.event_id THEN
      IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        UPDATE public.events
        SET active_registrations_count = (
          SELECT COUNT(*)::INTEGER FROM public.registrations
          WHERE event_id = OLD.event_id AND status IN ('registered', 'checked_in')
        )
        WHERE id = OLD.event_id;
      END IF;

      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = NEW.event_id AND status IN ('registered', 'checked_in')
      )
      WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status IN ('registered', 'checked_in') THEN
      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = OLD.event_id AND status IN ('registered', 'checked_in')
      )
      WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_event_active_registrations ON public.registrations;
CREATE TRIGGER trg_sync_event_active_registrations
AFTER INSERT OR UPDATE OR DELETE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_event_active_registrations();

-- Backfill active_registrations_count across all events including checked_in
UPDATE public.events e
SET active_registrations_count = COALESCE((
  SELECT COUNT(*)::INTEGER 
  FROM public.registrations r
  WHERE r.event_id = e.id AND r.status IN ('registered', 'checked_in')
), 0);

-- 2. Drop duplicate cancellation trigger to prevent double-promotion
DROP TRIGGER IF EXISTS trg_registration_cancellation_promotion ON public.registrations;
DROP FUNCTION IF EXISTS public.handle_registration_cancellation_promotion();

-- 3. Resequence function helper for waitlist ordering
CREATE OR REPLACE FUNCTION public.resequence_event_waitlist(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH numbered AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY registered_at ASC, id ASC) AS new_pos
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'waitlisted'
  )
  UPDATE public.registrations r
  SET waitlist_position = numbered.new_pos
  FROM numbered
  WHERE r.id = numbered.id;
END;
$$;

-- 4. Canonical register_for_event RPC
-- Clean up existing function signatures
DROP FUNCTION IF EXISTS public.register_for_event(UUID);
DROP FUNCTION IF EXISTS public.register_for_event(UUID, UUID);
DROP FUNCTION IF EXISTS public.register_for_event(UUID, JSONB, BOOLEAN);

CREATE OR REPLACE FUNCTION public.register_for_event(
  p_event_id UUID,
  p_answers JSONB DEFAULT NULL,
  p_allow_waitlist BOOLEAN DEFAULT TRUE
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_existing_reg RECORD;
  v_active_count INT;
  v_target_status registration_status;
  v_ticket_code TEXT;
  v_waitlist_pos INT;
  v_reg_id UUID;
  v_event_end_ts TIMESTAMPTZ;
  v_question RECORD;
  v_ans_text TEXT;
  v_key TEXT;
  v_val TEXT;
BEGIN
  -- 1. Ensure authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to register';
  END IF;

  -- 2. Lock event row for update
  SELECT id, title, slug, status, capacity, event_date, start_time, end_time, timezone, registration_deadline
  INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 3. Validate published status
  IF v_event.status != 'published' THEN
    RAISE EXCEPTION 'Event is not published (current status: %)', v_event.status;
  END IF;

  -- 4. Validate event has not concluded
  v_event_end_ts := (v_event.event_date + v_event.end_time) AT TIME ZONE COALESCE(v_event.timezone, 'UTC');
  IF NOW() > v_event_end_ts THEN
    RAISE EXCEPTION 'Event has already ended';
  END IF;

  -- 5. Validate registration deadline has not passed
  IF v_event.registration_deadline IS NOT NULL AND NOW() > v_event.registration_deadline THEN
    RAISE EXCEPTION 'Registration deadline has passed';
  END IF;

  -- 6. Check existing registration state
  SELECT id, status INTO v_existing_reg
  FROM public.registrations
  WHERE event_id = p_event_id AND user_id = v_user_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing_reg.status IN ('registered', 'checked_in') THEN
      RAISE EXCEPTION 'You are already registered for this event';
    ELSIF v_existing_reg.status = 'waitlisted' THEN
      RAISE EXCEPTION 'You are already on the waitlist for this event';
    END IF;
  END IF;

  -- 7. Validate required custom registration questions
  FOR v_question IN
    SELECT id, question_text, question_type, options, is_required
    FROM public.event_registration_questions
    WHERE event_id = p_event_id
    ORDER BY sort_order ASC
  LOOP
    IF v_question.is_required THEN
      v_ans_text := TRIM(COALESCE(p_answers->>v_question.id::TEXT, ''));
      IF v_ans_text IS NULL OR v_ans_text = '' THEN
        RAISE EXCEPTION 'Please answer the required question: "%"', v_question.question_text;
      END IF;
      IF v_question.question_type = 'checkbox' AND v_ans_text != 'true' THEN
        RAISE EXCEPTION 'Required agreement not confirmed: "%"', v_question.question_text;
      END IF;
    END IF;
  END LOOP;

  -- 8. Capacity Check (including checked_in attendees)
  SELECT COUNT(*)::INTEGER INTO v_active_count
  FROM public.registrations
  WHERE event_id = p_event_id AND status IN ('registered', 'checked_in');

  IF v_event.capacity IS NOT NULL AND v_active_count >= v_event.capacity THEN
    IF NOT p_allow_waitlist THEN
      RAISE EXCEPTION 'Event is at full capacity';
    END IF;
    v_target_status := 'waitlisted';
  ELSE
    v_target_status := 'registered';
  END IF;

  -- 9. Determine ticket code and waitlist position
  IF v_target_status = 'registered' THEN
    v_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event.slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));
    v_waitlist_pos := NULL;
  ELSE
    v_ticket_code := NULL;
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'waitlisted';
  END IF;

  -- 10. Persist registration record (new or reactivated)
  IF v_existing_reg.id IS NOT NULL THEN
    v_reg_id := v_existing_reg.id;
    UPDATE public.registrations
    SET
      status = v_target_status,
      ticket_code = v_ticket_code,
      waitlist_position = v_waitlist_pos,
      registered_at = NOW(),
      checked_in_at = NULL,
      checked_in_by = NULL
    WHERE id = v_reg_id;
  ELSE
    INSERT INTO public.registrations (
      event_id,
      user_id,
      status,
      ticket_code,
      waitlist_position,
      registered_at
    ) VALUES (
      p_event_id,
      v_user_id,
      v_target_status,
      v_ticket_code,
      v_waitlist_pos,
      NOW()
    )
    RETURNING id INTO v_reg_id;
  END IF;

  -- 11. Store custom question answers atomically
  IF p_answers IS NOT NULL AND jsonb_typeof(p_answers) = 'object' THEN
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_answers)
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.event_registration_questions
        WHERE id = v_key::UUID AND event_id = p_event_id
      ) AND TRIM(v_val) != '' THEN
        INSERT INTO public.registration_answers (registration_id, question_id, answer_text)
        VALUES (v_reg_id, v_key::UUID, TRIM(v_val))
        ON CONFLICT (registration_id, question_id)
        DO UPDATE SET answer_text = EXCLUDED.answer_text;
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'registration_id', v_reg_id,
    'status', v_target_status,
    'waitlist_position', v_waitlist_pos,
    'ticket_code', v_ticket_code
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID, JSONB, BOOLEAN) FROM public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID, JSONB, BOOLEAN) TO authenticated;

-- 5. Canonical cancel_registration RPC
DROP FUNCTION IF EXISTS public.cancel_registration(UUID);

CREATE OR REPLACE FUNCTION public.cancel_registration(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_reg RECORD;
  v_old_status registration_status;
  v_waitlist_id UUID;
  v_waitlist_user_id UUID;
  v_new_ticket_code TEXT;
  v_promoted_user_id UUID := NULL;
  v_promoted_reg_id UUID := NULL;
BEGIN
  -- 1. Ensure authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to cancel registration';
  END IF;

  -- 2. Lock event row for update
  SELECT id, title, slug INTO v_event
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 3. Lock user registration
  SELECT id, status INTO v_reg
  FROM public.registrations
  WHERE event_id = p_event_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_reg.status = 'cancelled' THEN
    RAISE EXCEPTION 'No active registration found for this event';
  END IF;

  v_old_status := v_reg.status;

  -- 4. Mark user's registration as cancelled
  UPDATE public.registrations
  SET
    status = 'cancelled',
    waitlist_position = NULL
  WHERE id = v_reg.id;

  -- 5. If previous status was capacity-consuming, promote AT MOST ONE waitlisted attendee
  IF v_old_status IN ('registered', 'checked_in') THEN
    SELECT id, user_id INTO v_waitlist_id, v_waitlist_user_id
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'waitlisted'
    ORDER BY registered_at ASC, id ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_waitlist_id IS NOT NULL THEN
      v_new_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event.slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));

      UPDATE public.registrations
      SET
        status = 'registered',
        ticket_code = v_new_ticket_code,
        waitlist_position = NULL,
        registered_at = NOW()
      WHERE id = v_waitlist_id;

      INSERT INTO public.notifications (
        user_id,
        event_id,
        type,
        title,
        message,
        link,
        is_read,
        created_at
      ) VALUES (
        v_waitlist_user_id,
        p_event_id,
        'waitlist_promoted',
        'You got a spot!',
        'A spot opened up for "' || v_event.title || '" and you have been promoted from the waitlist.',
        '/events/' || v_event.slug,
        false,
        NOW()
      );

      v_promoted_user_id := v_waitlist_user_id;
      v_promoted_reg_id := v_waitlist_id;
    END IF;
  END IF;

  -- 6. Resequence remaining waitlist positions
  PERFORM public.resequence_event_waitlist(p_event_id);

  RETURN json_build_object(
    'success', true,
    'cancelled_registration_id', v_reg.id,
    'previous_status', v_old_status,
    'promoted', v_promoted_user_id IS NOT NULL,
    'promoted_user_id', v_promoted_user_id,
    'promoted_registration_id', v_promoted_reg_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_registration(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.cancel_registration(UUID) TO authenticated;

-- 6. Update standalone promote_next_waitlisted_attendee to also resequence waitlist
CREATE OR REPLACE FUNCTION public.promote_next_waitlisted_attendee(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_waitlist_id UUID;
  v_waitlist_user_id UUID;
  v_event_title TEXT;
  v_event_slug TEXT;
  v_new_ticket_code TEXT;
BEGIN
  -- 1. Fetch event metadata
  SELECT title, slug INTO v_event_title, v_event_slug
  FROM public.events
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- 2. Atomically select the earliest waitlisted attendee for update
  SELECT id, user_id INTO v_waitlist_id, v_waitlist_user_id
  FROM public.registrations
  WHERE event_id = p_event_id AND status = 'waitlisted'
  ORDER BY registered_at ASC, id ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no one is on waitlist, return
  IF v_waitlist_id IS NULL THEN
    RETURN json_build_object('success', true, 'promoted', false);
  END IF;

  -- 3. Generate non-guessable ticket code
  v_new_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event_slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));

  -- 4. Promote attendee to registered
  UPDATE public.registrations
  SET
    status = 'registered',
    ticket_code = v_new_ticket_code,
    waitlist_position = NULL,
    registered_at = NOW()
  WHERE id = v_waitlist_id;

  -- 5. Create in-app notification for the promoted student
  INSERT INTO public.notifications (
    user_id,
    event_id,
    type,
    title,
    message,
    link,
    is_read,
    created_at
  ) VALUES (
    v_waitlist_user_id,
    p_event_id,
    'waitlist_promoted',
    'You got a spot!',
    'A spot opened up for "' || v_event_title || '" and you have been promoted from the waitlist.',
    '/events/' || v_event_slug,
    false,
    NOW()
  );

  -- 6. Resequence remaining waitlist positions
  PERFORM public.resequence_event_waitlist(p_event_id);

  RETURN json_build_object(
    'success', true,
    'promoted', true,
    'registration_id', v_waitlist_id,
    'user_id', v_waitlist_user_id,
    'ticket_code', v_new_ticket_code
  );
END;
$$;
