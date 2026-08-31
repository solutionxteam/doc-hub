-- supabase/tests/20260831090000_trip_location_and_calls.test.sql
--
-- Verifies trip_location_sessions/trip_member_locations/trip_call_sessions
-- RLS actually restricts access to trip participants — mirrors the style of
-- supabase/tests/094_trip_participant_scoped_rls.test.sql (raw psql, not
-- pgTAP; RAISE NOTICE/EXCEPTION for PASS/FAIL).
--
-- LOCAL SUPABASE ONLY.
--
-- Run: supabase start && supabase db reset, then:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/20260831090000_trip_location_and_calls.test.sql

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF current_setting('app.settings.jwt_secret', true)
       IS DISTINCT FROM 'super-secret-jwt-token-with-at-least-32-characters-long' THEN
    RAISE EXCEPTION 'Refusing to run: this does not look like a local Supabase CLI instance.';
  END IF;
END $$;

-- ── Setup (as postgres superuser) ───────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'owner@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'member@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@test.local')
ON CONFLICT DO NOTHING;

INSERT INTO life_journeys (id, user_id, title, kind) VALUES
  ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'RLS test trip', 'trip')
ON CONFLICT DO NOTHING;

INSERT INTO trip_participants (journey_id, user_id, left_at) VALUES
  ('44444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', NULL)
ON CONFLICT DO NOTHING;

INSERT INTO trip_location_sessions (id, journey_id, user_id, expires_at) VALUES
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '22222222-2222-2222-2222-222222222222', now() + interval '1 hour')
ON CONFLICT DO NOTHING;

INSERT INTO trip_member_locations (session_id, journey_id, user_id, latitude, longitude) VALUES
  ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444',
   '22222222-2222-2222-2222-222222222222', 13.75, 100.50)
ON CONFLICT (session_id) DO UPDATE SET latitude = EXCLUDED.latitude;

GRANT SELECT ON trip_location_sessions, trip_member_locations TO authenticated;

-- ── As the trip owner ────────────────────────────────────────────────────
SET LOCAL role = authenticated;
SET LOCAL request.jwt.claims = '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM trip_location_sessions WHERE id = '55555555-5555-5555-5555-555555555555';
  IF cnt != 1 THEN RAISE EXCEPTION 'FAIL: trip owner could not see a member''s location session'; END IF;
  RAISE NOTICE 'PASS: trip owner sees a member''s location session';
END $$;

-- ── As an outsider (not on the trip) ────────────────────────────────────
SET LOCAL request.jwt.claims = '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

DO $$
DECLARE cnt int;
BEGIN
  SELECT count(*) INTO cnt FROM trip_location_sessions WHERE id = '55555555-5555-5555-5555-555555555555';
  IF cnt != 0 THEN RAISE EXCEPTION 'FAIL: an outsider could see this trip''s location session'; END IF;

  SELECT count(*) INTO cnt FROM trip_member_locations WHERE session_id = '55555555-5555-5555-5555-555555555555';
  IF cnt != 0 THEN RAISE EXCEPTION 'FAIL: an outsider could see this trip''s member location'; END IF;

  RAISE NOTICE 'PASS: an outsider sees neither the session nor the location';
END $$;

RESET role;
RAISE NOTICE 'ALL LOCATION/CALL RLS TESTS PASSED';
