BEGIN;
SELECT plan(21);

-- Create test users
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'student1@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'student2@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'organizer1@example.com'),
  ('00000000-0000-0000-0000-000000000004', 'unverified_org@example.com');

-- Wait for triggers (profiles created automatically)
-- Update the third user to be a verified organizer
UPDATE public.profiles SET role = 'organizer', is_verified = true WHERE id = '00000000-0000-0000-0000-000000000003';

-- Update the fourth user to be an unverified organizer
UPDATE public.profiles SET role = 'organizer', is_verified = false WHERE id = '00000000-0000-0000-0000-000000000004';

-- ─── 1. Test Privacy & Profiles RLS ──────────────────────────────────────────
-- Authenticated student reads own profile
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

SELECT results_eq(
  'SELECT email FROM public.profiles WHERE id = ''00000000-0000-0000-0000-000000000001''',
  ARRAY['student1@example.com'],
  'Authenticated users can read own profile email'
);

-- Student cannot read another student's profile email
SELECT is_empty(
  'SELECT email FROM public.profiles WHERE id = ''00000000-0000-0000-0000-000000000002''',
  'Student cannot read another user''s profile'
);

-- Anonymous user cannot read profiles at all
SET LOCAL role = anon;
SET LOCAL request.jwt.claim.sub = '';

SELECT is_empty(
  'SELECT email FROM public.profiles',
  'Anonymous users cannot read profile emails'
);

-- Safe public organizer view returns verified organizers only
SELECT results_eq(
  'SELECT full_name FROM public.organizer_profiles WHERE id = ''00000000-0000-0000-0000-000000000003''',
  ARRAY['organizer1@example.com'],
  'Public can read safe verified organizer profiles'
);

-- Unverified organizer is excluded from public organizer_profiles view
SELECT is_empty(
  'SELECT full_name FROM public.organizer_profiles WHERE id = ''00000000-0000-0000-0000-000000000004''',
  'Unverified organizer is hidden from public organizer_profiles'
);

-- Switch back to student1
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

-- Attempt to update another user's profile should fail (silently filtered by RLS, 0 rows updated)
UPDATE public.profiles SET full_name = 'Hacked' WHERE id = '00000000-0000-0000-0000-000000000002';
SELECT is_empty(
  'SELECT id FROM public.profiles WHERE id = ''00000000-0000-0000-0000-000000000002'' AND full_name = ''Hacked''',
  'Cannot update someone else''s profile'
);

-- ─── 2. Test Role Escalation Prevention ──────────────────────────────────────
SELECT throws_ok(
  'UPDATE public.profiles SET role = ''organizer'' WHERE id = ''00000000-0000-0000-0000-000000000001''',
  'Cannot modify role or verification status',
  'Student cannot escalate own role to organizer'
);

SELECT throws_ok(
  'UPDATE public.profiles SET is_verified = true WHERE id = ''00000000-0000-0000-0000-000000000001''',
  'Cannot modify role or verification status',
  'Student cannot escalate own is_verified status'
);

-- ─── 3. Test Events RLS (Verified vs Unverified Organizers) ───────────────────
-- Unverified organizer cannot create events
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
SELECT throws_ok(
  'INSERT INTO public.events (organizer_id, title, slug, category, location, event_date, start_time, end_time, status) VALUES (''00000000-0000-0000-0000-000000000004'', ''Unverified Event'', ''unverified-event'', ''Workshop'', ''Room 2'', ''2027-01-01'', ''10:00'', ''12:00'', ''draft'')',
  'new row violates row-level security policy for table "events"',
  'Unverified organizer cannot create events'
);

-- Switch to verified organizer
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

INSERT INTO public.events (id, organizer_id, title, slug, category, location, event_date, start_time, end_time, status)
VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000003', 'Test Event', 'test-event', 'Workshop', 'Room 1', '2027-01-01', '10:00', '12:00', 'draft');

SELECT results_eq(
  'SELECT title FROM public.events WHERE id = ''11111111-1111-1111-1111-111111111111''',
  ARRAY['Test Event'],
  'Verified organizer can create and view their own draft events'
);

-- Switch back to student1
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT is_empty(
  'SELECT id FROM public.events WHERE id = ''11111111-1111-1111-1111-111111111111''',
  'Student cannot see draft events'
);

-- Organizer publishes event
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
UPDATE public.events SET status = 'published' WHERE id = '11111111-1111-1111-1111-111111111111';

-- Student can now see it
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
  'SELECT title FROM public.events WHERE id = ''11111111-1111-1111-1111-111111111111''',
  ARRAY['Test Event'],
  'Student can see published events'
);

-- Student attempts to update event (should fail silently)
UPDATE public.events SET title = 'Hacked Event' WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT results_eq(
  'SELECT title FROM public.events WHERE id = ''11111111-1111-1111-1111-111111111111''',
  ARRAY['Test Event'],
  'Student cannot update events'
);

-- ─── 4. Test Hardened Registration RPC (Register-as-self only) ────────────────
-- Student1 registers for published event using register_for_event RPC
SELECT public.register_for_event('11111111-1111-1111-1111-111111111111'::uuid);

SELECT results_eq(
  'SELECT status FROM public.registrations WHERE event_id = ''11111111-1111-1111-1111-111111111111'' AND user_id = ''00000000-0000-0000-0000-000000000001''',
  ARRAY['registered'::public.registration_status],
  'Student can register for event via hardened RPC and read own registration'
);

-- Student2 tries to see student1's registration
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT is_empty(
  'SELECT id FROM public.registrations WHERE user_id = ''00000000-0000-0000-0000-000000000001''',
  'Student2 cannot see Student1''s registration'
);

-- Organizer tries to see registrations for their event
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
SELECT results_eq(
  'SELECT user_id FROM public.registrations WHERE event_id = ''11111111-1111-1111-1111-111111111111''',
  ARRAY['00000000-0000-0000-0000-000000000001'::uuid],
  'Organizer can see registrations for their own event'
);

-- ─── 5. Test Registration Cancellation (Authenticated DELETE RLS) ────────────
-- Student2 attempts to delete Student1's registration (should fail silently, 0 rows deleted)
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
DELETE FROM public.registrations WHERE user_id = '00000000-0000-0000-0000-000000000001';

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
SELECT results_eq(
  'SELECT status FROM public.registrations WHERE user_id = ''00000000-0000-0000-0000-000000000001''',
  ARRAY['registered'::public.registration_status],
  'Student2 cannot delete Student1''s registration'
);

-- Student1 deletes own registration (cancellation)
DELETE FROM public.registrations WHERE user_id = '00000000-0000-0000-0000-000000000001';
SELECT is_empty(
  'SELECT id FROM public.registrations WHERE user_id = ''00000000-0000-0000-0000-000000000001''',
  'Student can cancel own registration via DELETE policy'
);

-- ─── 6. Test Favorites RLS ───────────────────────────────────────────────────
-- Student1 favorites an event
INSERT INTO public.favorites (id, event_id, user_id) 
VALUES ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001');

SELECT results_eq(
  'SELECT id FROM public.favorites WHERE id = ''33333333-3333-3333-3333-333333333333''',
  ARRAY['33333333-3333-3333-3333-333333333333'::uuid],
  'Student can create and see own favorite'
);

-- Student2 tries to see student1's favorite
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
SELECT is_empty(
  'SELECT id FROM public.favorites WHERE id = ''33333333-3333-3333-3333-333333333333''',
  'Student2 cannot see Student1''s favorite'
);

-- Student1 deletes favorite
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.favorites WHERE id = '33333333-3333-3333-3333-333333333333';
SELECT is_empty(
  'SELECT id FROM public.favorites WHERE id = ''33333333-3333-3333-3333-333333333333''',
  'Student can delete own favorite'
);

SELECT * FROM finish();
ROLLBACK;
