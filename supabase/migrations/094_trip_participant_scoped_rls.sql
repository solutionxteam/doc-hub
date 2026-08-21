-- ═══════════════════════════════════════════════════════════════════════════
-- 094_trip_participant_scoped_rls.sql
--
-- Replaces organization-scoped RLS on the 8 trip child tables with
-- participant-scoped RLS, matching the rule already enforced (and tested) in
-- application code by getTripAccess() (web/src/lib/trips/trip-access.ts):
-- a user may see a trip's data if they own it (life_journeys.user_id) or are
-- an active participant (trip_participants row, user_id set, left_at NULL).
--
-- Every trip API route already uses the service-role client + getTripAccess()
-- for its real authorization, bypassing RLS entirely — this migration closes
-- the gap in the two server-rendered pages that read trip data through the
-- RLS-bound client instead: web/src/app/(app)/trips/page.tsx and
-- web/src/app/(app)/trips/[id]/page.tsx. No application code changes.
--
-- life_journeys itself is deliberately NOT touched here — it's shared with
-- the unrelated Life Graph feature (web/src/app/(app)/life/journey/page.tsx),
-- which intentionally lists every org journey regardless of trip
-- participation, and stays on its existing org-scoped policy
-- (life_journeys_member, migration 025).
--
-- trip_settlements is also NOT touched — it belongs to a different, older
-- feature (trip-groups/split_bills, web/src/app/api/liff/trip-groups/), not
-- the life_journeys-based trip system this migration hardens.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper function ──────────────────────────────────────────────────────────
-- Mirrors the is_conversation_member() pattern from 055_recent_features_security.sql.
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

-- ── Direct journey_id tables (1 hop) ─────────────────────────────────────────
DROP POLICY IF EXISTS "tp_org_member" ON trip_participants;
CREATE POLICY "tp_participant" ON trip_participants FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "te_org_member" ON trip_expenses;
CREATE POLICY "te_participant" ON trip_expenses FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "tpay_org_member" ON trip_payments;
CREATE POLICY "tpay_participant" ON trip_payments FOR ALL USING (is_trip_participant(journey_id));

DROP POLICY IF EXISTS "preorder_sessions_org_member" ON preorder_sessions;
CREATE POLICY "preorder_sessions_participant" ON preorder_sessions FOR ALL USING (is_trip_participant(journey_id));

-- ── 2-hop tables ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "es_org_member" ON expense_splits;
CREATE POLICY "es_participant" ON expense_splits FOR ALL USING (
  is_trip_participant((SELECT journey_id FROM trip_expenses WHERE id = expense_splits.expense_id))
);

DROP POLICY IF EXISTS "preorder_items_org_member" ON preorder_items;
CREATE POLICY "preorder_items_participant" ON preorder_items FOR ALL USING (
  is_trip_participant((SELECT journey_id FROM preorder_sessions WHERE id = preorder_items.session_id))
);

-- ── Itinerary tables — consolidate the two redundant org-scoped policies ────
-- 055_recent_features_security.sql created trip_days_org_member/
-- trip_items_org_member scoped via the legacy split_bills path.
-- 074_itinerary_and_preorder.sql later added tid_org_member/tii_org_member
-- scoped via the current journey_id path, but never dropped the 055 ones —
-- both are active today (Postgres OR's multiple permissive policies
-- together). This block checks whether any row still only has the legacy
-- split_bill_id set (no journey_id) before deciding how to replace them: if
-- none do, the legacy path is provably dead and gets dropped cleanly; if any
-- do, their access is preserved via an OR-branch in the new single policy
-- rather than silently orphaning that data. Either way, the result is one
-- policy per table instead of two overlapping ones.
DO $$
DECLARE
  legacy_days_count  int;
  legacy_items_count int;
BEGIN
  SELECT count(*) INTO legacy_days_count
    FROM trip_itinerary_days
    WHERE journey_id IS NULL AND split_bill_id IS NOT NULL;

  SELECT count(*) INTO legacy_items_count
    FROM trip_itinerary_items
    WHERE day_id IN (
      SELECT id FROM trip_itinerary_days
      WHERE journey_id IS NULL AND split_bill_id IS NOT NULL
    );

  DROP POLICY IF EXISTS "tid_org_member" ON trip_itinerary_days;
  DROP POLICY IF EXISTS "trip_days_org_member" ON trip_itinerary_days;
  DROP POLICY IF EXISTS "tii_org_member" ON trip_itinerary_items;
  DROP POLICY IF EXISTS "trip_items_org_member" ON trip_itinerary_items;

  IF legacy_days_count = 0 AND legacy_items_count = 0 THEN
    RAISE NOTICE 'No rows depend on the legacy split_bill_id path — dropping it cleanly.';

    EXECUTE 'CREATE POLICY "tid_participant" ON trip_itinerary_days FOR ALL USING (
      journey_id IS NOT NULL AND is_trip_participant(journey_id)
    )';

    EXECUTE 'CREATE POLICY "tii_participant" ON trip_itinerary_items FOR ALL USING (
      is_trip_participant((SELECT journey_id FROM trip_itinerary_days WHERE id = trip_itinerary_items.day_id))
    )';
  ELSE
    RAISE NOTICE 'Found % legacy day row(s) and % legacy item row(s) still on split_bill_id — preserving their access.', legacy_days_count, legacy_items_count;

    EXECUTE 'CREATE POLICY "tid_participant" ON trip_itinerary_days FOR ALL USING (
      (journey_id IS NOT NULL AND is_trip_participant(journey_id))
      OR (split_bill_id IS NOT NULL AND split_bill_id IN (
        SELECT b.id FROM split_bills b
        JOIN organization_members om ON om.organization_id = b.organization_id
        WHERE om.user_id = auth.uid()
      ))
    )';

    EXECUTE 'CREATE POLICY "tii_participant" ON trip_itinerary_items FOR ALL USING (
      day_id IN (
        SELECT id FROM trip_itinerary_days d WHERE
          (d.journey_id IS NOT NULL AND is_trip_participant(d.journey_id))
          OR (d.split_bill_id IS NOT NULL AND d.split_bill_id IN (
            SELECT b.id FROM split_bills b
            JOIN organization_members om ON om.organization_id = b.organization_id
            WHERE om.user_id = auth.uid()
          ))
      )
    )';
  END IF;
END $$;
