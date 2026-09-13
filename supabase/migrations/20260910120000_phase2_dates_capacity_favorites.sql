-- Migration: 20260910120000_phase2_dates_capacity_favorites.sql
-- Purpose: Add event timezone, active registrations tracking, sync trigger, and harden registration RPC for active capacity and reactivation

-- 1. Add timezone column to events (default 'UTC')
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- 2. Add active_registrations_count column to events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS active_registrations_count INTEGER NOT NULL DEFAULT 0;

-- 3. Backfill active_registrations_count from existing registrations
UPDATE public.events e
SET active_registrations_count = COALESCE((
  SELECT COUNT(*)::INTEGER 
  FROM public.registrations r
  WHERE r.event_id = e.id AND r.status = 'registered'
), 0);

-- 4. Create trigger function to keep active_registrations_count synchronized
CREATE OR REPLACE FUNCTION public.sync_event_active_registrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'registered' THEN
      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = NEW.event_id AND status = 'registered'
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
          WHERE event_id = OLD.event_id AND status = 'registered'
        )
        WHERE id = OLD.event_id;
      END IF;

      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = NEW.event_id AND status = 'registered'
      )
      WHERE id = NEW.event_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'registered' THEN
      UPDATE public.events
      SET active_registrations_count = (
        SELECT COUNT(*)::INTEGER FROM public.registrations
        WHERE event_id = OLD.event_id AND status = 'registered'
      )
      WHERE id = OLD.event_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Create trigger on registrations
DROP TRIGGER IF EXISTS trg_sync_event_active_registrations ON public.registrations;
CREATE TRIGGER trg_sync_event_active_registrations
AFTER INSERT OR UPDATE OR DELETE ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.sync_event_active_registrations();

-- 5. Harden register_for_event RPC
-- Ensures active registrations only count towards capacity,
-- prevents duplicate active registrations, and allows re-registration if previously cancelled.
CREATE OR REPLACE FUNCTION public.register_for_event(p_event_id UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_capacity INT;
  v_current_registrations INT;
  v_status event_status;
BEGIN
  -- 1. Ensure user is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in to register';
  END IF;

  -- 2. Lock event row for update to prevent concurrent capacity race conditions
  SELECT capacity, status INTO v_capacity, v_status
  FROM public.events
  WHERE id = p_event_id
  FOR UPDATE;

  -- 3. Validate event existence
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  -- 4. Validate event status
  IF v_status != 'published' THEN
    RAISE EXCEPTION 'Event is not published (current status: %)', v_status;
  END IF;

  -- 5. Check if user already has an active registration
  IF EXISTS (
    SELECT 1 FROM public.registrations
    WHERE event_id = p_event_id AND user_id = v_user_id AND status = 'registered'
  ) THEN
    RAISE EXCEPTION 'User is already registered for this event';
  END IF;

  -- 6. Check capacity against active registrations only
  IF v_capacity IS NOT NULL THEN
    SELECT COUNT(*)::INTEGER INTO v_current_registrations
    FROM public.registrations
    WHERE event_id = p_event_id AND status = 'registered';

    IF v_current_registrations >= v_capacity THEN
      RAISE EXCEPTION 'Event is at full capacity';
    END IF;
  END IF;

  -- 7. Insert or reactivate registration for the authenticated user
  INSERT INTO public.registrations (event_id, user_id, status, registered_at)
  VALUES (p_event_id, v_user_id, 'registered', NOW())
  ON CONFLICT (event_id, user_id) 
  DO UPDATE SET status = 'registered', registered_at = NOW();

  RETURN json_build_object('success', true, 'message', 'Successfully registered');
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_for_event(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.register_for_event(UUID) TO authenticated;
