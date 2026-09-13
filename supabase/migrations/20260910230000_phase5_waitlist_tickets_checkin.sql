-- Migration: 20260910230000_phase5_waitlist_tickets_checkin.sql
-- Description: Phase 5 attendance lifecycle: waitlist support, atomic FIFO promotion, secure tickets, and idempotent check-in.

-- 1. Note: registration_status enum values ('waitlisted', 'checked_in') were committed in preceding migration 20260910225000_phase5_add_waitlist_status_enum.sql
-- (Ensures PostgreSQL transactional safety so new enum values can be indexed/queried below)

-- 2. Add ticket and check-in tracking columns to public.registrations
ALTER TABLE public.registrations
ADD COLUMN IF NOT EXISTS ticket_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS waitlist_position INTEGER;

-- Create index for fast ticket lookup and check-in
CREATE INDEX IF NOT EXISTS idx_registrations_ticket_code
  ON public.registrations (ticket_code)
  WHERE ticket_code IS NOT NULL;

-- Create index for waitlist queue ordering
CREATE INDEX IF NOT EXISTS idx_registrations_waitlist_order
  ON public.registrations (event_id, registered_at ASC)
  WHERE status = 'waitlisted';

-- 3. Extend notifications type constraint to include waitlist_promoted and checked_in
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'registration_confirmed',
    'event_cancelled',
    'event_rescheduled',
    'venue_changed',
    'reminder',
    'waitlist_promoted',
    'checked_in'
  ));

-- 4. Atomic Waitlist Promotion Procedure
-- When an active attendee cancels, promote the earliest eligible waitlisted attendee
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
  ORDER BY registered_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no one is on waitlist, return
  IF v_waitlist_id IS NULL THEN
    RETURN json_build_object('success', true, 'promoted', false);
  END IF;

  -- 3. Generate non-guessable ticket code (format: CL-<event_slug_prefix>-<random_hex>)
  v_new_ticket_code := 'CL-' || UPPER(SUBSTRING(v_event_slug, 1, 6)) || '-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8));

  -- 4. Promote attendee to registered
  UPDATE public.registrations
  SET
    status = 'registered',
    ticket_code = v_new_ticket_code,
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

  RETURN json_build_object(
    'success', true,
    'promoted', true,
    'registration_id', v_waitlist_id,
    'user_id', v_waitlist_user_id,
    'ticket_code', v_new_ticket_code
  );
END;
$$;

-- 5. Trigger to automatically promote waitlist on registration cancellation
CREATE OR REPLACE FUNCTION public.handle_registration_cancellation_promotion()
RETURNS trigger AS $$
BEGIN
  -- When an active registration becomes cancelled, trigger promotion
  IF (OLD.status IN ('registered', 'checked_in') AND NEW.status = 'cancelled') THEN
    PERFORM public.promote_next_waitlisted_attendee(NEW.event_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_registration_cancellation_promotion ON public.registrations;
CREATE TRIGGER trg_registration_cancellation_promotion
AFTER UPDATE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.handle_registration_cancellation_promotion();

-- 6. Idempotent Check-in RPC for Organizers & Event Staff
CREATE OR REPLACE FUNCTION public.check_in_attendee(p_event_id UUID, p_ticket_code TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_organizer BOOLEAN;
  v_registration RECORD;
  v_user_profile RECORD;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify organizer authorization for this event
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = p_event_id AND organizer_id = v_caller_id
  ) INTO v_is_organizer;

  IF NOT v_is_organizer THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: You are not the organizer of this event');
  END IF;

  -- Find registration by ticket code
  SELECT r.id, r.event_id, r.user_id, r.status, r.ticket_code, r.checked_in_at
  INTO v_registration
  FROM public.registrations r
  WHERE r.ticket_code = p_ticket_code;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Ticket not found');
  END IF;

  -- Prevent a ticket from one event being used for another
  IF v_registration.event_id != p_event_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid ticket: This ticket belongs to a different event'
    );
  END IF;

  -- Fetch attendee profile
  SELECT full_name, email INTO v_user_profile
  FROM public.profiles
  WHERE id = v_registration.user_id;

  -- Idempotent check: already checked in
  IF v_registration.status = 'checked_in' THEN
    RETURN json_build_object(
      'success', true,
      'already_checked_in', true,
      'checked_in_at', v_registration.checked_in_at,
      'attendee', json_build_object(
        'id', v_registration.user_id,
        'full_name', v_user_profile.full_name,
        'email', v_user_profile.email
      )
    );
  END IF;

  -- Reject if waitlisted or cancelled
  IF v_registration.status != 'registered' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Cannot check in: attendee status is ' || v_registration.status
    );
  END IF;

  -- Mark as checked in
  UPDATE public.registrations
  SET
    status = 'checked_in',
    checked_in_at = NOW(),
    checked_in_by = v_caller_id
  WHERE id = v_registration.id;

  RETURN json_build_object(
    'success', true,
    'already_checked_in', false,
    'checked_in_at', NOW(),
    'attendee', json_build_object(
      'id', v_registration.user_id,
      'full_name', v_user_profile.full_name,
      'email', v_user_profile.email
    )
  );
END;
$$;
