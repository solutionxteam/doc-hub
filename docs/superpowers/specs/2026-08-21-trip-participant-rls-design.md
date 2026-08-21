# Trip Participant-Scoped RLS — Design

**Status:** Approved by user 2026-08-21 (scope, cleanup, and testing approach confirmed via three clarifying questions — see Decisions Confirmed below). Ready for `writing-plans`.

## Problem

Every trip mutation route (`web/src/app/api/trips/**`) already enforces correct, participant-level authorization in application code via `getTripAccess()`/`canManageTrip()` (`web/src/lib/trips/trip-access.ts`), using the Supabase **service-role** client, which bypasses Postgres RLS entirely. That logic is solid and already unit-tested (`trip-conversation.test.mjs`, 17/17 passing).

But two server-rendered pages read trip data through the **RLS-enforced** client instead of service-role:

- `web/src/app/(app)/trips/page.tsx` — the trips list, `.from("life_journeys").select(...trip_participants(...))`
- `web/src/app/(app)/trips/[id]/page.tsx` — trip detail, same pattern plus separate `trip_expenses`/`trip_payments` queries and a `.rpc("calculate_trip_settlement")` call

Confirmed by reading every trip-related file for its Supabase client choice (`grep -rn "createClient()\|createAdminClient()"` across `web/src/app/(app)/trips` and `web/src/app/api/trips`): these are the only two trip-data reads that go through the RLS-bound client rather than service-role.

The RLS policies those two pages actually rely on are still **organization-scoped**, not participant-scoped (confirmed by reading every `CREATE POLICY` touching a trip table across `supabase/migrations/*.sql`):

| Table | Current policy | Migration |
|---|---|---|
| `trip_participants` | `tp_org_member` — org membership | 030 |
| `trip_expenses` | `te_org_member` — org membership | 030 |
| `expense_splits` | `es_org_member` — org membership | 030 |
| `trip_payments` | `tpay_org_member` — org membership | 030 |
| `trip_itinerary_days` | `tid_org_member` (journey_id path, org) **+** `trip_days_org_member` (legacy split_bill_id path, org) — both active | 074, 055 |
| `trip_itinerary_items` | `tii_org_member` (journey_id path, org) **+** `trip_items_org_member` (legacy split_bill_id path, org) — both active | 074, 055 |
| `preorder_sessions` | `preorder_sessions_org_member` — org membership | 074 |
| `preorder_items` | `preorder_items_org_member` — org membership | 074 |

`life_journeys` itself has its own org-scoped policy (`life_journeys_member`, migration 025), separately.

**The actual gap:** any member of an organization can, today, read every trip's participant list, who-owes-what amounts, itinerary, and preorder items for **every trip in that org** via those two SSR pages — not just trips they're actually on. `trip-access.ts`'s own comment states the intended rule explicitly: *"Org membership alone is deliberately NOT enough to be a participant: the owning org can be large, and a trip is a personal, social record."* The RLS layer doesn't yet enforce that rule; only the application layer does, and only for the routes that use service-role.

## Complication: `life_journeys` is shared with an unrelated feature

`life_journeys` is also the backing table for a separate "Life Graph" journal feature (`web/src/app/(app)/life/journey/page.tsx`, `web/src/app/api/life/journeys/route.ts`, `web/src/app/api/life/graph/route.ts`) that intentionally lists **every** `life_journeys` row for the org, trip or not, via the RLS-bound client — this is a household/org-wide activity journal, not participant-scoped by design. Confirmed by reading all three files: none of them filter by `trip_type`, and all three rely on `life_journeys`'s org-scoped RLS to work correctly today.

## Decisions Confirmed (with user, 2026-08-21)

1. **Scope:** Harden only the 8 trip-specific child tables listed above. Leave `life_journeys` itself org-scoped and untouched — it must keep working for Life Graph. (Rejected alternative: restrict `life_journeys` too, which would require adding a matching filter to the Life Graph feature — bigger change, outside this work's boundary.)
2. **Cleanup:** While touching `trip_itinerary_days`/`trip_itinerary_items`, also resolve the redundant dual-policy situation (see below) rather than leaving both active.
3. **Testing:** RLS cannot be verified by the existing `node --test` harness (in-memory fake DB, no real Postgres). Verify via a local Supabase stack (`supabase start`, already available: CLI installed, `supabase/config.toml` present, Docker running) plus a SQL test script simulating three real users via `request.jwt.claims`.

Also checked and confirmed **out of scope**: `trip_settlements` carries an org-scoped policy from migration 055, but that table belongs to a completely different, older feature (`trip-groups`/`split_bills`, used only by `web/src/app/api/liff/trip-groups/[id]/settlements/route.ts`) — not the `life_journeys`-based trip system this design touches. Its org-scoped policy is correct for its actual use case; leave it alone.

## Approach

Add one `SECURITY DEFINER` helper function, mirroring the existing `is_conversation_member()` pattern already established in migration 055 (`supabase/migrations/055_recent_features_security.sql:4-16`):

```sql
CREATE OR REPLACE FUNCTION public.is_trip_participant(p_journey_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM life_journeys
    WHERE id = p_journey_id AND user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM trip_participants
    WHERE journey_id = p_journey_id AND user_id = auth.uid() AND left_at IS NULL
  );
$$;
REVOKE ALL ON FUNCTION public.is_trip_participant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trip_participant(uuid) TO authenticated;
```

This is a direct SQL mirror of `getTripAccess()`'s existing, already-tested rule (`trip-access.ts:47-79`): owner (`life_journeys.user_id`) OR active participant (`trip_participants` row with `user_id` set and `left_at IS NULL`). Two layers, same rule — the SQL test script (see Testing) is what keeps them honest against each other, since there's no way to share the logic itself between TypeScript and a Postgres policy.

**Rejected alternative:** inline the owner-OR-participant subquery separately into each of the 8 policies. Rejected because the join depth to `journey_id` differs by table (`trip_participants`/`trip_expenses`/`trip_payments`/`trip_itinerary_days`/`preorder_sessions` are 1 hop; `expense_splits`/`trip_itinerary_items`/`preorder_items` are 2 hops through a parent). Maintaining that logic correctly in 8 places, 3 different ways, is exactly what a shared function exists to avoid — and the codebase already has precedent for this exact pattern (`is_conversation_member()`).

## Scope: policies to replace

New migration: `supabase/migrations/094_trip_participant_scoped_rls.sql` (next number after the current latest, `093_remove_legacy_upsert_vendor_overload.sql`).

**Direct `journey_id` tables** (1 hop) — `trip_participants`, `trip_expenses`, `trip_payments`, `preorder_sessions`:

```sql
DROP POLICY IF EXISTS "tp_org_member" ON trip_participants;
CREATE POLICY "tp_participant" ON trip_participants FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "te_org_member" ON trip_expenses;
CREATE POLICY "te_participant" ON trip_expenses FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "tpay_org_member" ON trip_payments;
CREATE POLICY "tpay_participant" ON trip_payments FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "preorder_sessions_org_member" ON preorder_sessions;
CREATE POLICY "preorder_sessions_participant" ON preorder_sessions FOR ALL USING (is_trip_participant(journey_id));
```

**2-hop tables** — `expense_splits` (via `trip_expenses.journey_id`), `preorder_items` (via `preorder_sessions.journey_id`):

```sql
DROP POLICY IF EXISTS "es_org_member" ON expense_splits;
CREATE POLICY "es_participant" ON expense_splits FOR ALL USING (
  is_trip_participant((SELECT journey_id FROM trip_expenses WHERE id = expense_splits.expense_id))
);

DROP POLICY IF EXISTS "preorder_items_org_member" ON preorder_items;
CREATE POLICY "preorder_items_participant" ON preorder_items FOR ALL USING (
  is_trip_participant((SELECT journey_id FROM preorder_sessions WHERE id = preorder_items.session_id))
);
```

**Itinerary tables — the redundant-policy cleanup.** `trip_itinerary_days`/`trip_itinerary_items` carry a legacy `split_bill_id` column (nullable) alongside the current `journey_id` column, per migration 074's own comment: *"already had everything needed... but was wired to split_bills — the older single-payer bill system — via split_bill_id, never to life_journeys."* Migration 074 re-pointed the app at `journey_id` and added a new org-scoped policy for that path, but did **not** drop the original 055 policy (different name, same table) — so both are active today, OR'd together by Postgres's multi-permissive-policy semantics.

Simply dropping the 055 policy (as "cleanup") would silently cut off RLS access to any row that still only has `split_bill_id` set (no `journey_id`) — if any such rows exist. **Before writing the DROP,** the implementation must check:

```sql
SELECT count(*) FROM trip_itinerary_days  WHERE journey_id IS NULL AND split_bill_id IS NOT NULL;
SELECT count(*) FROM trip_itinerary_items WHERE day_id IN (SELECT id FROM trip_itinerary_days WHERE journey_id IS NULL AND split_bill_id IS NOT NULL);
```

If both are zero (expected — `web/src/app/api/trips/[id]/itinerary/route.ts` already writes only `journey_id` today, confirmed via `grep -n "createAdminClient\|createClient" web/src/app/api/trips/[id]/itinerary/route.ts`, and that route is the only writer), collapse both old policies into one clean participant-scoped policy per table:

```sql
DROP POLICY IF EXISTS "tid_org_member" ON trip_itinerary_days;
DROP POLICY IF EXISTS "trip_days_org_member" ON trip_itinerary_days;
CREATE POLICY "tid_participant" ON trip_itinerary_days FOR ALL USING (
  journey_id IS NOT NULL AND is_trip_participant(journey_id)
);

DROP POLICY IF EXISTS "tii_org_member" ON trip_itinerary_items;
DROP POLICY IF EXISTS "trip_items_org_member" ON trip_itinerary_items;
CREATE POLICY "tii_participant" ON trip_itinerary_items FOR ALL USING (
  is_trip_participant((SELECT journey_id FROM trip_itinerary_days WHERE id = trip_itinerary_items.day_id))
);
```

If either count is nonzero, the migration must instead preserve an org-scoped OR-branch for the `split_bill_id` path (same shape as the original 055 policy) alongside the new participant-scoped `journey_id` branch, in the same policy — not two separate policies. Which path applies is a fact to be checked at implementation time, not decided here; the plan must include both migration variants and the count-check that picks between them.

**Untouched:** `life_journeys` (`life_journeys_member`, stays org-scoped — Decision 1), `trip_settlements` (belongs to the unrelated `trip-groups` system — confirmed out of scope above).

## No application code changes

Confirmed by the same grep used in Problem: every trip API route uses service-role for its actual data reads/writes, with `getTripAccess()`/`canManageTrip()` doing real authorization in application code — unaffected by this migration, since RLS never applied to those code paths in the first place. This migration closes the gap in exactly the two SSR pages named above, with zero code changes required — they already do a plain `.from(...).select(...)` through the RLS-bound client, which will simply start returning the correctly-scoped rows once the policies change.

## Testing

1. `supabase start` — local Postgres, isolated from the real dev/prod project, migrations (including the new one) applied automatically.
2. A SQL test script (`supabase/tests/` or similar — exact location and harness choice is a `writing-plans` decision, not fixed here) that:
   - Creates 3 `auth.users` rows: trip **owner**, active **participant**, and an **org-outsider** (member of the same organization, but never added to this trip).
   - Creates one trip (`life_journeys` row owned by the owner) and one row in each of the 8 hardened tables.
   - For each table, runs the same `SELECT` as each simulated user (via `SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}'` or the equivalent Supabase local-testing idiom) and asserts: owner sees it, participant sees it, org-outsider does **not**.
   - Adds a **departed-participant** case (`left_at` set) asserting they no longer see it — mirrors the existing unit test `"a departed participant loses trip access without deleting expense identity"` in `trip-conversation.test.mjs`, at the RLS layer this time.
3. Regression: re-run `npm run typecheck` and `npm run test:trips` from `web/` — expected unchanged (no application code touched).

## Risk / Rollback

Pure `DROP POLICY` + `CREATE POLICY` (plus one new `SECURITY DEFINER` function) — no data migration, no column or table changes. Fully reversible by re-running the original `CREATE POLICY` statements quoted in the Problem section's table, in a follow-up migration, if something breaks. Since no application code path currently depends on the org-scoped bypass being permissive (every route already uses service-role), the only realistic production risk is a logic bug in the new policies under-returning data on the two SSR pages — exactly what the SQL test script in Testing is built to catch before this ships.
