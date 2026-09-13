-- Migration: 20260912180000_phase15_ecosystem_venues_networking_translations_integrations.sql
-- Purpose: Phase 15 - Structured venues and maps, opt-in networking mode, multi-language event content,
--          outbound feeds, Discord/Slack announcement integrations, and campus partner API access.

-- ============================================================================
-- 1. CAMPUS VENUES & STRUCTURED LOCATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campus_venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID REFERENCES public.campuses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  building TEXT,
  floor TEXT,
  room TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accessibility_details TEXT,
  directions_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_venues_campus_id ON public.campus_venues(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_venues_name ON public.campus_venues(name);

-- Add venue columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.campus_venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS building TEXT,
  ADD COLUMN IF NOT EXISTS floor TEXT,
  ADD COLUMN IF NOT EXISTS room TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS accessibility_details TEXT,
  ADD COLUMN IF NOT EXISTS directions_url TEXT,
  ADD COLUMN IF NOT EXISTS reschedule_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);

-- Venues updated_at trigger
DROP TRIGGER IF EXISTS set_campus_venues_updated_at ON public.campus_venues;
CREATE TRIGGER set_campus_venues_updated_at
BEFORE UPDATE ON public.campus_venues
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS on campus_venues
ALTER TABLE public.campus_venues ENABLE ROW LEVEL SECURITY;

-- Anyone can read active campus venues
DROP POLICY IF EXISTS "Anyone can view active campus venues" ON public.campus_venues;
CREATE POLICY "Anyone can view active campus venues"
  ON public.campus_venues FOR SELECT
  USING (is_active = true);

-- Authenticated users with organizer/admin role can manage campus venues
DROP POLICY IF EXISTS "Organizers and admins can manage campus venues" ON public.campus_venues;
CREATE POLICY "Organizers and admins can manage campus venues"
  ON public.campus_venues FOR ALL
  TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'organizer'
    )
  );

-- ============================================================================
-- 2. OPTIONAL NETWORKING MODE & CONTACT EXCHANGE
-- ============================================================================

-- User networking profile card (approved fields only)
CREATE TABLE IF NOT EXISTS public.user_networking_cards (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  course_or_major TEXT,
  headline TEXT,
  interests TEXT[] NOT NULL DEFAULT '{}',
  linkedin_url TEXT,
  portfolio_url TEXT,
  github_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for networking card updated_at
DROP TRIGGER IF EXISTS set_user_networking_cards_updated_at ON public.user_networking_cards;
CREATE TRIGGER set_user_networking_cards_updated_at
BEFORE UPDATE ON public.user_networking_cards
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Event networking attendee opt-in
CREATE TABLE IF NOT EXISTS public.event_networking_attendees (
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_opted_in BOOLEAN NOT NULL DEFAULT true,
  exchange_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_networking_attendees_event_opt ON public.event_networking_attendees(event_id, is_opted_in);
CREATE INDEX IF NOT EXISTS idx_event_networking_attendees_token ON public.event_networking_attendees(exchange_token);

-- Contact exchange requests
CREATE TABLE IF NOT EXISTS public.contact_exchange_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_exchange_event ON public.contact_exchange_requests(event_id);
CREATE INDEX IF NOT EXISTS idx_contact_exchange_requester ON public.contact_exchange_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_contact_exchange_recipient ON public.contact_exchange_requests(recipient_id);

-- Trigger for contact exchange requests updated_at
DROP TRIGGER IF EXISTS set_contact_exchange_requests_updated_at ON public.contact_exchange_requests;
CREATE TRIGGER set_contact_exchange_requests_updated_at
BEFORE UPDATE ON public.contact_exchange_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- User networking blocks
CREATE TABLE IF NOT EXISTS public.networking_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

-- Update moderation_reports check constraint to include 'networking_profile'
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_target_type_check;
ALTER TABLE public.moderation_reports
  ADD CONSTRAINT moderation_reports_target_type_check
  CHECK (target_type IN ('event', 'organizer', 'feedback', 'photo', 'networking_profile'));

-- Enable RLS on networking tables
ALTER TABLE public.user_networking_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_networking_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_exchange_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.networking_blocks ENABLE ROW LEVEL SECURITY;

-- Policies for user_networking_cards
DROP POLICY IF EXISTS "Users can manage own networking card" ON public.user_networking_cards;
CREATE POLICY "Users can manage own networking card"
  ON public.user_networking_cards FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Accepted exchange partners can view networking card" ON public.user_networking_cards;
CREATE POLICY "Accepted exchange partners can view networking card"
  ON public.user_networking_cards FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.contact_exchange_requests cer
      WHERE cer.status = 'accepted'
        AND (
          (cer.requester_id = auth.uid() AND cer.recipient_id = user_networking_cards.user_id) OR
          (cer.recipient_id = auth.uid() AND cer.requester_id = user_networking_cards.user_id)
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.networking_blocks nb
          WHERE (nb.blocker_id = auth.uid() AND nb.blocked_id = user_networking_cards.user_id)
             OR (nb.blocker_id = user_networking_cards.user_id AND nb.blocked_id = auth.uid())
        )
    )
  );

-- Policies for event_networking_attendees
DROP POLICY IF EXISTS "Users can manage own event networking opt-in" ON public.event_networking_attendees;
CREATE POLICY "Users can manage own event networking opt-in"
  ON public.event_networking_attendees FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Attendees can view opted-in peers for same event" ON public.event_networking_attendees;
CREATE POLICY "Attendees can view opted-in peers for same event"
  ON public.event_networking_attendees FOR SELECT
  TO authenticated
  USING (
    is_opted_in = true AND
    NOT EXISTS (
      SELECT 1 FROM public.networking_blocks nb
      WHERE (nb.blocker_id = auth.uid() AND nb.blocked_id = event_networking_attendees.user_id)
         OR (nb.blocker_id = event_networking_attendees.user_id AND nb.blocked_id = auth.uid())
    )
  );

-- Policies for contact_exchange_requests
DROP POLICY IF EXISTS "Users can view relevant exchange requests" ON public.contact_exchange_requests;
CREATE POLICY "Users can view relevant exchange requests"
  ON public.contact_exchange_requests FOR SELECT
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

DROP POLICY IF EXISTS "Users can create exchange requests" ON public.contact_exchange_requests;
CREATE POLICY "Users can create exchange requests"
  ON public.contact_exchange_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid() AND
    NOT EXISTS (
      SELECT 1 FROM public.networking_blocks nb
      WHERE (nb.blocker_id = auth.uid() AND nb.blocked_id = recipient_id)
         OR (nb.blocker_id = recipient_id AND nb.blocked_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Recipients or requesters can update exchange requests" ON public.contact_exchange_requests;
CREATE POLICY "Recipients or requesters can update exchange requests"
  ON public.contact_exchange_requests FOR UPDATE
  TO authenticated
  USING (requester_id = auth.uid() OR recipient_id = auth.uid());

-- Policies for networking_blocks
DROP POLICY IF EXISTS "Users can manage their own blocks" ON public.networking_blocks;
CREATE POLICY "Users can manage their own blocks"
  ON public.networking_blocks FOR ALL
  TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- ============================================================================
-- 3. MULTI-LANGUAGE EVENT CONTENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL,
  language_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  is_machine_translated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, language_code)
);

CREATE INDEX IF NOT EXISTS idx_event_translations_event_lang ON public.event_translations(event_id, language_code);

-- Trigger for event_translations updated_at
DROP TRIGGER IF EXISTS set_event_translations_updated_at ON public.event_translations;
CREATE TRIGGER set_event_translations_updated_at
BEFORE UPDATE ON public.event_translations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable RLS on event_translations
ALTER TABLE public.event_translations ENABLE ROW LEVEL SECURITY;

-- Public can read translations for published events
DROP POLICY IF EXISTS "Anyone can view translations for published events" ON public.event_translations;
CREATE POLICY "Anyone can view translations for published events"
  ON public.event_translations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_translations.event_id
        AND e.status = 'published'
    )
  );

-- Organizers and event editors can manage translations
DROP POLICY IF EXISTS "Organizers can manage event translations" ON public.event_translations;
CREATE POLICY "Organizers can manage event translations"
  ON public.event_translations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_translations.event_id
        AND (
          e.organizer_id = auth.uid() OR
          public.is_admin() OR
          EXISTS (
            SELECT 1 FROM public.event_team_members etm
            WHERE etm.event_id = e.id AND etm.user_id = auth.uid() AND etm.role IN ('co_organizer', 'editor')
          )
        )
    )
  );

-- ============================================================================
-- 4. INTEGRATIONS & PARTNER API
-- ============================================================================

-- Webhook integrations for Discord & Slack
CREATE TABLE IF NOT EXISTS public.event_webhook_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('discord', 'slack', 'generic')),
  webhook_url TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  notify_on_announcement BOOLEAN NOT NULL DEFAULT true,
  notify_on_reschedule BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_webhooks_event_id ON public.event_webhook_integrations(event_id);

-- Trigger for event_webhook_integrations updated_at
DROP TRIGGER IF EXISTS set_event_webhook_integrations_updated_at ON public.event_webhook_integrations;
CREATE TRIGGER set_event_webhook_integrations_updated_at
BEFORE UPDATE ON public.event_webhook_integrations
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Campus API Keys for approved partner integration
CREATE TABLE IF NOT EXISTS public.campus_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  rate_limit_per_minute INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campus_api_keys_campus_id ON public.campus_api_keys(campus_id);
CREATE INDEX IF NOT EXISTS idx_campus_api_keys_hash ON public.campus_api_keys(key_hash);

-- Enable RLS
ALTER TABLE public.event_webhook_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campus_api_keys ENABLE ROW LEVEL SECURITY;

-- Organizers and team members can manage webhook integrations
DROP POLICY IF EXISTS "Organizers can manage webhook integrations" ON public.event_webhook_integrations;
CREATE POLICY "Organizers can manage webhook integrations"
  ON public.event_webhook_integrations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_webhook_integrations.event_id
        AND (
          e.organizer_id = auth.uid() OR
          public.is_admin() OR
          EXISTS (
            SELECT 1 FROM public.event_team_members etm
            WHERE etm.event_id = e.id AND etm.user_id = auth.uid() AND etm.role IN ('co_organizer', 'editor')
          )
        )
    )
  );

-- Admins can manage campus API keys
DROP POLICY IF EXISTS "Admins can manage campus API keys" ON public.campus_api_keys;
CREATE POLICY "Admins can manage campus API keys"
  ON public.campus_api_keys FOR ALL
  TO authenticated
  USING (public.is_admin());
