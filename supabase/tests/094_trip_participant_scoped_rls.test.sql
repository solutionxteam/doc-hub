-- supabase/tests/094_trip_participant_scoped_rls.test.sql
--
-- Verifies the participant-scoped RLS added by
-- 094_trip_participant_scoped_rls.sql actually restricts visibility on the 8
-- hardened trip tables. Creates a trip owner, an active participant, an
-- org-outsider (same organization, never added to the trip), a departed
-- participant (was on the trip, left), and an outside-org participant (on
-- the trip, but not a member of its organization) — then simulates each one
-- via request.jwt.claims and asserts who can see (and write) what.
--
-- Not a pgTAP suite (this repo has no pgTAP convention to extend) — run
-- directly via psql, per the invocation below. Every PASS/FAIL is a
-- RAISE NOTICE/EXCEPTION, not TAP output.
--
-- LOCAL SUPABASE ONLY. Refuses to run against anything but 127.0.0.1/::1
-- (see the guard immediately below) — this script seeds fake auth.users,
-- an org, and trip data, and GRANTs SELECT/INSERT on 9 tables to
-- `authenticated`. Never point it at a real project.
--
-- Run: supabase start && supabase db reset (applies 094), then:
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/094_trip_participant_scoped_rls.test.sql

\set ON_ERROR_STOP on

-- IP-based checks (inet_server_addr()/inet_client_addr()) don't work here —
-- through Docker's port-forwarding both report container-internal addresses
-- (e.g. 172.19.0.x), not 127.0.0.1, even for a genuinely local connection.
-- Instead, check for the JWT secret Supabase CLI hard-codes into every local
-- instance by default (public, documented, identical across all local
-- stacks) — a real project would never have this as its actual signing
-- secret without a much bigger problem than this script.
DO $$
BEGIN
  IF current_setting('app.settings.jwt_secret', true)
       IS DISTINCT FROM 'super-secret-jwt-token-with-at-least-32-characters-long' THEN
    RAISE EXCEPTION 'Refusing to run: this does not look like a local Supabase CLI instance (unexpected JWT secret). This script seeds fake auth.users/org/trip data and GRANTs SELECT/INSERT on 9 tables to authenticated — never point it at anything but a local stack.';
  END IF;
END $$;

-- ── Setup (as postgres superuser — bypasses RLS entirely) ──────────────────
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'rls-owner@test.local',       'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'rls-participant@test.local', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'rls-outsider@test.local',    'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-000000000000', 'rls-departed@test.local',    'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-000000000000', 'rls-outside-org@test.local', 'x', now(), now(), now(), '{}', '{}', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO organizations (id, name, slug)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'RLS Test Org', 'rls-test-org-094')
ON CONFLICT (id) DO NOTHING;

-- Deliberately NOT adding user 'e' (outside-org) as an organization_member —
-- that's the point of that fixture.
INSERT INTO organization_members (organization_id, user_id, role)
VALUES
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000b', 'viewer'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000c', 'viewer'),
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000d', 'viewer')
ON CONFLICT (organization_id, user_id) DO NOTHING;

INSERT INTO life_journeys (id, organization_id, user_id, title, journey_type, trip_type)
VALUES ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000000a', 'RLS Test Trip', 'trip', 'travel')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_participants (id, journey_id, user_id, display_name, is_host)
VALUES ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000a', 'Owner', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_participants (id, journey_id, user_id, display_name)
VALUES ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000b', 'Participant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_participants (id, journey_id, user_id, display_name, left_at)
VALUES ('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000d', 'Departed', now())
ON CONFLICT (id) DO NOTHING;

-- Invited as a Slippy friend (web/src/app/api/trips/[id]/members/route.ts
-- has no org-membership requirement) but not in organization_members for
-- this trip's org — proves participant status alone is sufficient, per the
-- header comment in 094_trip_participant_scoped_rls.sql.
INSERT INTO trip_participants (id, journey_id, user_id, display_name)
VALUES ('00000000-0000-0000-0000-0000000000f0', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000000e', 'Outside-Org Participant')
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_expenses (id, journey_id, paid_by_id, title, amount, amount_base_currency)
VALUES ('00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f3', 'Test Expense', 100, 100)
ON CONFLICT (id) DO NOTHING;

INSERT INTO expense_splits (id, expense_id, participant_id, amount)
VALUES ('00000000-0000-0000-0000-0000000000f7', '00000000-0000-0000-0000-0000000000f6', '00000000-0000-0000-0000-0000000000f4', 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_payments (id, journey_id, from_participant, to_participant, amount)
VALUES ('00000000-0000-0000-0000-0000000000f8', '00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f3', 50)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_itinerary_days (id, journey_id, day_number)
VALUES ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000f2', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO trip_itinerary_items (id, day_id, title)
VALUES ('00000000-0000-0000-0000-0000000000fa', '00000000-0000-0000-0000-0000000000f9', 'Test Activity')
ON CONFLICT (id) DO NOTHING;

INSERT INTO preorder_sessions (id, journey_id, title)
VALUES ('00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000f2', 'Test Preorder')
ON CONFLICT (id) DO NOTHING;

INSERT INTO preorder_items (id, session_id, participant_id, name, price)
VALUES ('00000000-0000-0000-0000-0000000000fc', '00000000-0000-0000-0000-0000000000fb', '00000000-0000-0000-0000-0000000000f4', 'Test Item', 60)
ON CONFLICT (id) DO NOTHING;

-- ── Local test-environment grants ───────────────────────────────────────────
-- `authenticated` has no table-level GRANT on any of these 8 tables (or
-- life_journeys) anywhere in the tracked migration history — confirmed via
-- information_schema.role_table_grants on a fresh local replay. Since the
-- app is live and these are the exact tables the two SSR pages read via the
-- RLS-bound client, this almost certainly means the real project has these
-- grants applied out-of-band (e.g. dashboard SQL editor), consistent with
-- this repo's documented history of untracked remote-only migrations — not
-- something to "fix" here; flagged separately as a follow-up. These GRANTs
-- exist ONLY so this local test can exercise RLS at all (grants gate table
-- access before RLS ever evaluates rows); they are not part of, and do not
-- belong in, migration 094 itself.
GRANT SELECT ON life_journeys, trip_participants, trip_expenses, expense_splits,
  trip_payments, trip_itinerary_days, trip_itinerary_items, preorder_sessions,
  preorder_items TO authenticated;
-- INSERT on trip_expenses only, so the write-path checks below prove RLS's
-- WITH CHECK is what blocks the outsider — not a missing table grant.
GRANT INSERT ON trip_expenses TO authenticated;

-- ── Assertion helpers ────────────────────────────────────────────────────────
-- Plain SECURITY INVOKER functions: run under whatever role/JWT the calling
-- session has active via SET LOCAL, so they see/do exactly what that
-- impersonated user would through RLS.
CREATE OR REPLACE FUNCTION pg_temp.assert_visible(p_label text, p_sql text, p_expect_visible boolean)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  n int;
BEGIN
  EXECUTE p_sql INTO n;
  IF p_expect_visible AND n = 0 THEN
    RAISE EXCEPTION 'FAIL: % — expected the row to be visible, saw none', p_label;
  ELSIF NOT p_expect_visible AND n > 0 THEN
    RAISE EXCEPTION 'FAIL: % — expected the row to be hidden, saw %', p_label, n;
  ELSE
    RAISE NOTICE 'PASS: %', p_label;
  END IF;
END;
$$;

-- p_expect_allowed = true: the write must succeed (re-raises on failure).
-- p_expect_allowed = false: the write must be rejected by RLS specifically
-- (insufficient_privilege, i.e. "new row violates row-level security
-- policy") — the implicit subtransaction PL/pgSQL creates around a block
-- with an EXCEPTION clause absorbs the error without aborting the caller's
-- outer BEGIN/COMMIT.
CREATE OR REPLACE FUNCTION pg_temp.assert_write(p_label text, p_sql text, p_expect_allowed boolean)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  IF p_expect_allowed THEN
    RAISE NOTICE 'PASS: %', p_label;
  ELSE
    RAISE EXCEPTION 'FAIL: % — expected the write to be rejected, but it succeeded', p_label;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    IF p_expect_allowed THEN
      RAISE EXCEPTION 'FAIL: % — expected the write to succeed, got: %', p_label, SQLERRM;
    ELSE
      RAISE NOTICE 'PASS: % (rejected: %)', p_label, SQLERRM;
    END IF;
END;
$$;

-- ── Per-user, per-table checks ───────────────────────────────────────────────
-- One BEGIN/COMMIT block per simulated user so SET LOCAL doesn't leak between
-- them. Each block re-runs the same 8 counts; TABLE_CHECKS is inlined per
-- block rather than looped, since looping would require its own layer of
-- dynamic SQL for no real reduction in what's being verified.

-- Owner: must see everything.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}';
SELECT pg_temp.assert_visible('owner sees trip_participants',    'SELECT count(*) FROM trip_participants WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('owner sees trip_expenses',        'SELECT count(*) FROM trip_expenses WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('owner sees expense_splits',       'SELECT count(*) FROM expense_splits WHERE id = ''00000000-0000-0000-0000-0000000000f7''', true);
SELECT pg_temp.assert_visible('owner sees trip_payments',        'SELECT count(*) FROM trip_payments WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('owner sees trip_itinerary_days',  'SELECT count(*) FROM trip_itinerary_days WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('owner sees trip_itinerary_items', 'SELECT count(*) FROM trip_itinerary_items WHERE id = ''00000000-0000-0000-0000-0000000000fa''', true);
SELECT pg_temp.assert_visible('owner sees preorder_sessions',    'SELECT count(*) FROM preorder_sessions WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('owner sees preorder_items',       'SELECT count(*) FROM preorder_items WHERE id = ''00000000-0000-0000-0000-0000000000fc''', true);
COMMIT;

-- Active participant: must see everything too, and can write a trip expense.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';
SELECT pg_temp.assert_visible('participant sees trip_participants',    'SELECT count(*) FROM trip_participants WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('participant sees trip_expenses',        'SELECT count(*) FROM trip_expenses WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('participant sees expense_splits',       'SELECT count(*) FROM expense_splits WHERE id = ''00000000-0000-0000-0000-0000000000f7''', true);
SELECT pg_temp.assert_visible('participant sees trip_payments',        'SELECT count(*) FROM trip_payments WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('participant sees trip_itinerary_days',  'SELECT count(*) FROM trip_itinerary_days WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('participant sees trip_itinerary_items', 'SELECT count(*) FROM trip_itinerary_items WHERE id = ''00000000-0000-0000-0000-0000000000fa''', true);
SELECT pg_temp.assert_visible('participant sees preorder_sessions',    'SELECT count(*) FROM preorder_sessions WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('participant sees preorder_items',       'SELECT count(*) FROM preorder_items WHERE id = ''00000000-0000-0000-0000-0000000000fc''', true);
SELECT pg_temp.assert_write('participant can insert a trip_expenses row',
  'INSERT INTO trip_expenses (id, journey_id, paid_by_id, title, amount, amount_base_currency) VALUES (''00000000-0000-0000-0000-0000000000fd'', ''00000000-0000-0000-0000-0000000000f2'', ''00000000-0000-0000-0000-0000000000f4'', ''Participant Write Test'', 10, 10)',
  true);
COMMIT;

-- Org-outsider: same org, never added to the trip — must see nothing, and
-- must not be able to write a trip expense either (WITH CHECK, not just
-- USING — FOR ALL policies reuse the USING expression for both). This is
-- the case that was BROKEN before this migration (org-scoped RLS let them
-- see everything); it's the core regression this whole plan exists to fix.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';
SELECT pg_temp.assert_visible('outsider does NOT see trip_participants',    'SELECT count(*) FROM trip_participants WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
SELECT pg_temp.assert_visible('outsider does NOT see trip_expenses',        'SELECT count(*) FROM trip_expenses WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
SELECT pg_temp.assert_visible('outsider does NOT see expense_splits',       'SELECT count(*) FROM expense_splits WHERE id = ''00000000-0000-0000-0000-0000000000f7''', false);
SELECT pg_temp.assert_visible('outsider does NOT see trip_payments',        'SELECT count(*) FROM trip_payments WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
SELECT pg_temp.assert_visible('outsider does NOT see trip_itinerary_days',  'SELECT count(*) FROM trip_itinerary_days WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
SELECT pg_temp.assert_visible('outsider does NOT see trip_itinerary_items', 'SELECT count(*) FROM trip_itinerary_items WHERE id = ''00000000-0000-0000-0000-0000000000fa''', false);
SELECT pg_temp.assert_visible('outsider does NOT see preorder_sessions',    'SELECT count(*) FROM preorder_sessions WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
SELECT pg_temp.assert_visible('outsider does NOT see preorder_items',       'SELECT count(*) FROM preorder_items WHERE id = ''00000000-0000-0000-0000-0000000000fc''', false);
SELECT pg_temp.assert_write('outsider cannot insert a trip_expenses row',
  'INSERT INTO trip_expenses (id, journey_id, paid_by_id, title, amount, amount_base_currency) VALUES (''00000000-0000-0000-0000-0000000000fe'', ''00000000-0000-0000-0000-0000000000f2'', ''00000000-0000-0000-0000-0000000000f4'', ''Outsider Write Test'', 10, 10)',
  false);
COMMIT;

-- Departed participant: left_at is set — must see nothing (mirrors the
-- existing unit test "a departed participant loses trip access" in
-- trip-conversation.test.mjs, verified here at the RLS layer instead of the
-- application layer). Checked once via trip_participants — the rule lives
-- entirely inside is_trip_participant(), shared by all 8 policies, so this
-- is sufficient to prove departure is honored, not something that needs
-- re-verifying per table.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}';
SELECT pg_temp.assert_visible('departed participant does NOT see trip_participants', 'SELECT count(*) FROM trip_participants WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', false);
COMMIT;

-- Outside-org participant: on the trip, but not a member of its
-- organization — must see everything anyway. Proves participant status
-- alone grants access, matching getTripAccess() and confirmed as intended
-- (see the header comment in 094_trip_participant_scoped_rls.sql). This is
-- the one place this migration is deliberately MORE permissive than the
-- org-scoped policies it replaces, not just narrower — worth its own
-- explicit, positive test rather than leaving it as an unexamined side
-- effect of the other cases passing.
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000000e","role":"authenticated"}';
SELECT pg_temp.assert_visible('outside-org participant sees trip_participants',    'SELECT count(*) FROM trip_participants WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('outside-org participant sees trip_expenses',        'SELECT count(*) FROM trip_expenses WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('outside-org participant sees expense_splits',       'SELECT count(*) FROM expense_splits WHERE id = ''00000000-0000-0000-0000-0000000000f7''', true);
SELECT pg_temp.assert_visible('outside-org participant sees trip_payments',        'SELECT count(*) FROM trip_payments WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('outside-org participant sees trip_itinerary_days',  'SELECT count(*) FROM trip_itinerary_days WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('outside-org participant sees trip_itinerary_items', 'SELECT count(*) FROM trip_itinerary_items WHERE id = ''00000000-0000-0000-0000-0000000000fa''', true);
SELECT pg_temp.assert_visible('outside-org participant sees preorder_sessions',    'SELECT count(*) FROM preorder_sessions WHERE journey_id = ''00000000-0000-0000-0000-0000000000f2''', true);
SELECT pg_temp.assert_visible('outside-org participant sees preorder_items',       'SELECT count(*) FROM preorder_items WHERE id = ''00000000-0000-0000-0000-0000000000fc''', true);
COMMIT;

-- If every line above printed PASS with no FAIL/ERROR, and psql was invoked
-- with -v ON_ERROR_STOP=1, this script exits 0. Any RAISE EXCEPTION aborts
-- the containing transaction and returns nonzero.
