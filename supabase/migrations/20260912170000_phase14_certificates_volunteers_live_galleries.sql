-- Migration: 20260912170000_phase14_certificates_volunteers_live_galleries.sql
-- Description: Phase 14 - Add value after registration and during live events (Certificates, Volunteer Management, Live Announcements, and Curated Galleries)

-- ─── 1. Certificates Configuration & Issuance ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_certificate_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  eligibility TEXT NOT NULL DEFAULT 'checked_in' CHECK (eligibility IN ('checked_in', 'registered', 'manual')),
  title TEXT NOT NULL DEFAULT 'Certificate of Attendance',
  description TEXT,
  issuer_name TEXT,
  signatory_title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_configs_event ON public.event_certificate_configs(event_id);
ALTER TABLE public.event_certificate_configs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.event_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  certificate_code TEXT NOT NULL UNIQUE,
  verification_hash TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT,
  CONSTRAINT uq_event_certificates_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_certs_user ON public.event_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_event_certs_event ON public.event_certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_event_certs_code ON public.event_certificates(certificate_code);
ALTER TABLE public.event_certificates ENABLE ROW LEVEL SECURITY;

-- ─── 2. Volunteer Management ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_volunteer_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  required_skills TEXT,
  shift_start TIMESTAMPTZ,
  shift_end TIMESTAMPTZ,
  capacity INTEGER NOT NULL DEFAULT 5 CHECK (capacity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_volunteer_roles_event ON public.event_volunteer_roles(event_id);
ALTER TABLE public.event_volunteer_roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.event_volunteer_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.event_volunteer_roles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'checked_in', 'cancelled')),
  notes TEXT,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_event_volunteer_role_user UNIQUE (role_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_volunteer_signups_user ON public.event_volunteer_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_event ON public.event_volunteer_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_volunteer_signups_role ON public.event_volunteer_signups(role_id);
ALTER TABLE public.event_volunteer_signups ENABLE ROW LEVEL SECURITY;

-- ─── 3. Live Event Announcements Updates ─────────────────────────────────────
ALTER TABLE public.event_announcements
  ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.event_announcements DROP CONSTRAINT IF EXISTS chk_event_announcements_category;
ALTER TABLE public.event_announcements
  ADD CONSTRAINT chk_event_announcements_category
  CHECK (category IN ('general', 'venue_change', 'schedule', 'emergency', 'food'));

CREATE INDEX IF NOT EXISTS idx_announcements_pinned ON public.event_announcements(event_id, is_pinned DESC, created_at DESC);

-- ─── 4. Event Photo Galleries & Privacy ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_photos_event ON public.event_photos(event_id, created_at DESC);
ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.event_photo_privacy_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  opt_out_photo_appearances BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_photo_privacy_user ON public.event_photo_privacy_preferences(user_id);
ALTER TABLE public.event_photo_privacy_preferences ENABLE ROW LEVEL SECURITY;

-- ─── 5. Moderation Reports Target Update ─────────────────────────────────────
ALTER TABLE public.moderation_reports DROP CONSTRAINT IF EXISTS moderation_reports_target_type_check;
ALTER TABLE public.moderation_reports
  ADD CONSTRAINT moderation_reports_target_type_check
  CHECK (target_type IN ('event', 'organizer', 'photo'));

-- ─── 6. Public Certificate Verification RPC ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.verify_certificate(p_certificate_code TEXT)
RETURNS TABLE (
  is_valid BOOLEAN,
  certificate_code TEXT,
  recipient_name TEXT,
  event_title TEXT,
  event_date TEXT,
  issuer_name TEXT,
  certificate_title TEXT,
  status TEXT,
  issued_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (c.status = 'valid') AS is_valid,
    c.certificate_code,
    c.recipient_name,
    e.title AS event_title,
    e.event_date,
    COALESCE(cfg.issuer_name, p.full_name, 'Campus Organizer') AS issuer_name,
    COALESCE(cfg.title, 'Certificate of Attendance') AS certificate_title,
    c.status,
    c.issued_at
  FROM public.event_certificates c
  JOIN public.events e ON e.id = c.event_id
  JOIN public.profiles p ON p.id = e.organizer_id
  LEFT JOIN public.event_certificate_configs cfg ON cfg.event_id = c.event_id
  WHERE c.certificate_code = p_certificate_code;
$$;

GRANT EXECUTE ON FUNCTION public.verify_certificate(TEXT) TO anon, authenticated;

-- ─── 7. Row Level Security Policies ──────────────────────────────────────────

-- Certificate Configs
DROP POLICY IF EXISTS "Public can view cert configs for events" ON public.event_certificate_configs;
CREATE POLICY "Public can view cert configs for events"
  ON public.event_certificate_configs FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Organizers can manage cert configs" ON public.event_certificate_configs;
CREATE POLICY "Organizers can manage cert configs"
  ON public.event_certificate_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_certificate_configs.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_certificate_configs.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

-- Certificates
DROP POLICY IF EXISTS "Attendees can view own certificates" ON public.event_certificates;
CREATE POLICY "Attendees can view own certificates"
  ON public.event_certificates FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_certificates.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Organizers can manage certificates" ON public.event_certificates;
CREATE POLICY "Organizers can manage certificates"
  ON public.event_certificates FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_certificates.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_certificates.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

-- Volunteer Roles
DROP POLICY IF EXISTS "Public can view volunteer roles" ON public.event_volunteer_roles;
CREATE POLICY "Public can view volunteer roles"
  ON public.event_volunteer_roles FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_roles.event_id AND e.status = 'published'
    )
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_roles.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Organizers can manage volunteer roles" ON public.event_volunteer_roles;
CREATE POLICY "Organizers can manage volunteer roles"
  ON public.event_volunteer_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_roles.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_roles.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

-- Volunteer Signups
DROP POLICY IF EXISTS "Users can view own volunteer signups" ON public.event_volunteer_signups;
CREATE POLICY "Users can view own volunteer signups"
  ON public.event_volunteer_signups FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_signups.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can apply for volunteer roles" ON public.event_volunteer_signups;
CREATE POLICY "Users can apply for volunteer roles"
  ON public.event_volunteer_signups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users and organizers can update volunteer signups" ON public.event_volunteer_signups;
CREATE POLICY "Users and organizers can update volunteer signups"
  ON public.event_volunteer_signups FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_signups.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_signups.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can delete own pending volunteer signups" ON public.event_volunteer_signups;
CREATE POLICY "Users can delete own volunteer signups"
  ON public.event_volunteer_signups FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_volunteer_signups.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

-- Event Photos
DROP POLICY IF EXISTS "Public can view event photos" ON public.event_photos;
CREATE POLICY "Public can view event photos"
  ON public.event_photos FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Only organizers can upload event photos" ON public.event_photos;
CREATE POLICY "Only organizers can upload event photos"
  ON public.event_photos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_photos.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Only organizers can delete event photos" ON public.event_photos;
CREATE POLICY "Only organizers can delete event photos"
  ON public.event_photos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_photos.event_id
        AND (e.organizer_id = auth.uid() OR public.has_event_team_role(e.id, auth.uid()))
    )
  );

-- Photo Privacy Preferences
DROP POLICY IF EXISTS "Users can view own photo privacy" ON public.event_photo_privacy_preferences;
CREATE POLICY "Users can view own photo privacy"
  ON public.event_photo_privacy_preferences FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'organizer'
    )
  );

DROP POLICY IF EXISTS "Users can insert own photo privacy" ON public.event_photo_privacy_preferences;
CREATE POLICY "Users can insert own photo privacy"
  ON public.event_photo_privacy_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own photo privacy" ON public.event_photo_privacy_preferences;
CREATE POLICY "Users can update own photo privacy"
  ON public.event_photo_privacy_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
