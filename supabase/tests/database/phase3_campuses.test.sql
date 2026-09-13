BEGIN;
SELECT plan(10);

-- 1. Schema checks
SELECT has_table('public', 'campuses', 'campuses table must exist');
SELECT has_column('public', 'campuses', 'name', 'campuses must have name column');
SELECT has_column('public', 'campuses', 'slug', 'campuses must have slug column');
SELECT has_column('public', 'campuses', 'approved_domains', 'campuses must have approved_domains column');
SELECT has_column('public', 'campuses', 'is_active', 'campuses must have is_active column');

SELECT has_column('public', 'profiles', 'campus_id', 'profiles must have campus_id column');
SELECT has_column('public', 'events', 'campus_id', 'events must have campus_id column');

-- 2. Check organizer_profiles view columns
SELECT has_column('public', 'organizer_profiles', 'campus_id', 'organizer_profiles view must include campus_id');
SELECT has_column('public', 'organizer_profiles', 'is_verified', 'organizer_profiles view must include is_verified');

-- 3. Test strict event campus inheritance trigger
-- Create organizer with UC Berkeley campus (c0000000-0000-0000-0000-000000000002)
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000031', 'phase3_org@berkeley.edu');

UPDATE public.profiles
SET role = 'organizer',
    is_verified = true,
    campus_id = 'c0000000-0000-0000-0000-000000000002'
WHERE id = '00000000-0000-0000-0000-000000000031';

-- Attempt to insert event for Stanford (c0000000-0000-0000-0000-000000000003) while organizer is from Berkeley -> must throw
SELECT throws_ok(
  $$
  INSERT INTO public.events (
    id, organizer_id, title, slug, category, location, event_date, start_time, end_time, capacity, status, timezone, campus_id
  ) VALUES (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000031',
    'Phase 3 Cross Campus Illegal Event',
    'phase-3-cross-campus-illegal-event',
    'Technology',
    'Stanford Quad',
    '2027-03-01',
    '14:00',
    '16:00',
    50,
    'published',
    'UTC',
    'c0000000-0000-0000-0000-000000000003'
  );
  $$,
  'Events must strictly belong to the organizer''s campus',
  'Trigger must prevent organizers from assigning events to a different campus'
);

SELECT * FROM finish();
ROLLBACK;
