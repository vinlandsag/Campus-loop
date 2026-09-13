-- Phase 4: Make Event Changes Trustworthy
-- 1. Alter events table with reason and change tracking
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS change_notice TEXT NULL,
ADD COLUMN IF NOT EXISTS rescheduled_at TIMESTAMPTZ NULL;

-- 2. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('registration_confirmed', 'event_cancelled', 'event_rescheduled', 'venue_changed', 'reminder')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user unread queries and sorted retrieval
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications (user_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications RLS: Users can only see their own notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Notifications RLS: Users can update own notifications (e.g. mark as read)
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Notifications RLS: Allow authenticated users / server workflows to insert notifications
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Deletion policy trigger: Prevent deletion of events that have any registrations
CREATE OR REPLACE FUNCTION public.check_event_deletion_safety()
RETURNS trigger AS $$
DECLARE
  v_registration_count INTEGER;
BEGIN
  SELECT count(*) INTO v_registration_count
  FROM public.registrations
  WHERE event_id = OLD.id;

  IF v_registration_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete an event that has registrations (found % registered attendees). The event must be cancelled with an explanation instead.', v_registration_count;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_event_deletion_with_registrations ON public.events;
CREATE TRIGGER trg_prevent_event_deletion_with_registrations
BEFORE DELETE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.check_event_deletion_safety();
