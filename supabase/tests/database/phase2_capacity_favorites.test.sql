BEGIN;
SELECT plan(10);

-- 1. Verify schema additions
SELECT has_column('public', 'events', 'timezone', 'events table must have timezone column');
SELECT has_column('public', 'events', 'active_registrations_count', 'events table must have active_registrations_count column');

-- 2. Setup test data
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000021', 'phase2_student1@example.com'),
  ('00000000-0000-0000-0000-000000000022', 'phase2_student2@example.com'),
  ('00000000-0000-0000-0000-000000000023', 'phase2_org@example.com');

UPDATE public.profiles SET role = 'organizer', is_verified = true WHERE id = '00000000-0000-0000-0000-000000000023';

-- Create an event with capacity = 1
INSERT INTO public.events (id, organizer_id, title, slug, category, location, event_date, start_time, end_time, capacity, status, timezone)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000023',
  'Phase 2 Limited Event',
  'phase-2-limited-event',
  'Technology',
  'Lab A',
  '2027-02-01',
  '14:00',
  '16:00',
  1,
  'published',
  'UTC'
);

-- Check initial active_registrations_count is 0
SELECT results_eq(
  'SELECT active_registrations_count FROM public.events WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[0],
  'Initial active_registrations_count is 0'
);

-- 3. Student 1 registers for the event
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';

SELECT public.register_for_event('22222222-2222-2222-2222-222222222222'::uuid);

-- Active count should now be 1
SELECT results_eq(
  'SELECT active_registrations_count FROM public.events WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[1],
  'Registering increments active_registrations_count to 1'
);

-- 4. Student 2 attempts to register for full event (capacity = 1) -> must fail
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';

SELECT throws_ok(
  'SELECT public.register_for_event(''22222222-2222-2222-2222-222222222222''::uuid)',
  'Event is at full capacity',
  'Cannot register for an event that has reached full capacity'
);

-- 5. Student 1 cancels their registration
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';

UPDATE public.registrations
SET status = 'cancelled'
WHERE event_id = '22222222-2222-2222-2222-222222222222'
  AND user_id = '00000000-0000-0000-0000-000000000021';

-- Active count should now be 0 (cancellation frees spot)
SELECT results_eq(
  'SELECT active_registrations_count FROM public.events WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[0],
  'Cancelling decrements active_registrations_count back to 0'
);

-- 6. Student 2 registers now that the spot has been reopened by cancellation
SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000022';

SELECT lives_ok(
  'SELECT public.register_for_event(''22222222-2222-2222-2222-222222222222''::uuid)',
  'Student 2 successfully registers after cancellation frees a spot'
);

SELECT results_eq(
  'SELECT active_registrations_count FROM public.events WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[1],
  'Active count is back to 1'
);

-- 7. Student 1 re-registers when another spot opens (organizer increases capacity)
UPDATE public.events SET capacity = 2 WHERE id = '22222222-2222-2222-2222-222222222222';

SET LOCAL request.jwt.claim.sub = '00000000-0000-0000-0000-000000000021';
SELECT lives_ok(
  'SELECT public.register_for_event(''22222222-2222-2222-2222-222222222222''::uuid)',
  'Student 1 successfully re-registers after previously cancelling without unique violation'
);

SELECT results_eq(
  'SELECT active_registrations_count FROM public.events WHERE id = ''22222222-2222-2222-2222-222222222222''',
  ARRAY[2],
  'Active count is now 2'
);

ROLLBACK;
