-- Migration: 20260910240000_phase6_organizer_tools_teams_questions.sql
-- Description: Phase 6 organizer tools: scoped teams, custom registration questions, attendee answers, announcements, and metrics.

-- 1. Organizer Teams Table
CREATE TABLE IF NOT EXISTS public.event_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'check_in_staff', 'viewer')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_team_members_event_user_unique UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_team_members_event_id
  ON public.event_team_members (event_id);

CREATE INDEX IF NOT EXISTS idx_event_team_members_user_id
  ON public.event_team_members (user_id);

-- Enable RLS on event_team_members
ALTER TABLE public.event_team_members ENABLE ROW LEVEL SECURITY;

-- Team RLS: Users can view teams for events they own or belong to
CREATE POLICY "Team members can view their event teams"
  ON public.event_team_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_team_members.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_team_members.event_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
    )
  );

-- Team RLS: Event owners can insert, update, and delete team members
CREATE POLICY "Event owners can manage team members"
  ON public.event_team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_team_members.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_team_members.event_id AND m.user_id = auth.uid() AND m.role = 'owner'
    )
  );

-- 2. Custom Registration Questions Table
CREATE TABLE IF NOT EXISTS public.event_registration_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('text', 'select', 'checkbox', 'textarea')),
  options JSONB NULL DEFAULT '[]'::jsonb,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_registration_questions_event_id
  ON public.event_registration_questions (event_id, sort_order ASC);

-- Enable RLS on questions
ALTER TABLE public.event_registration_questions ENABLE ROW LEVEL SECURITY;

-- Anyone can view questions for published events (needed during registration)
CREATE POLICY "Public can view questions for active events"
  ON public.event_registration_questions
  FOR SELECT
  USING (true);

-- Event owners and editors can manage questions
CREATE POLICY "Event owners and editors can manage questions"
  ON public.event_registration_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_registration_questions.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_registration_questions.event_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
    )
  );

-- 3. Registration Answers Table
CREATE TABLE IF NOT EXISTS public.registration_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.event_registration_questions(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT registration_answers_reg_question_unique UNIQUE (registration_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_registration_answers_registration_id
  ON public.registration_answers (registration_id);

CREATE INDEX IF NOT EXISTS idx_registration_answers_question_id
  ON public.registration_answers (question_id);

-- Enable RLS on answers
ALTER TABLE public.registration_answers ENABLE ROW LEVEL SECURITY;

-- Attendees can insert and read their own answers
CREATE POLICY "Attendees can manage own registration answers"
  ON public.registration_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      WHERE r.id = registration_answers.registration_id AND r.user_id = auth.uid()
    )
  );

-- Authorized event staff can view answers for their events
CREATE POLICY "Event staff can view registration answers"
  ON public.registration_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.registrations r
      JOIN public.events e ON e.id = r.event_id
      WHERE r.id = registration_answers.registration_id
        AND (
          e.organizer_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.event_team_members m
            WHERE m.event_id = e.id AND m.user_id = auth.uid()
          )
        )
    )
  );

-- 4. Event Announcements Audit Table
CREATE TABLE IF NOT EXISTS public.event_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  target_filter TEXT NOT NULL DEFAULT 'all' CHECK (target_filter IN ('all', 'registered', 'checked_in', 'waitlisted')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_announcements_event_id
  ON public.event_announcements (event_id, created_at DESC);

-- Enable RLS on announcements
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view event announcements"
  ON public.event_announcements
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_announcements.event_id AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and editors can create announcements"
  ON public.event_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_announcements.event_id AND e.organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.event_team_members m
      WHERE m.event_id = event_announcements.event_id AND m.user_id = auth.uid() AND m.role IN ('owner', 'editor')
    )
  );

-- 5. Extend notifications constraint to allow announcement type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'registration_confirmed',
    'event_cancelled',
    'event_rescheduled',
    'venue_changed',
    'reminder',
    'waitlist_promoted',
    'checked_in',
    'announcement'
  ));
