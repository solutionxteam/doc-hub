# Activity Graph rollout runbook

## Purpose and scope

This runbook releases the additive Activity Graph foundation without replacing
the existing trip itinerary, map, documents, expenses, LINE, or profile flows.
`activities` is the canonical record for an activity. Existing trip rows remain
where they are and are linked through nullable references.

## Production gate

Do **not** run `supabase db push` until all items below are true:

1. The linked Supabase migration history agrees with the repository migration
   files. Any remote migration version without a reviewed source file must be
   recovered from the backup/NAS archive and its checksum recorded before using
   `supabase migration repair`.
2. A recoverable database backup has a named destination, retention period,
   encryption owner, and named restore operator.
3. The restore operator has restored that backup to an isolated database and
   run the reconciliation query below.
4. The web and iOS builds listed in **Verification** pass from the release
   commit.

This gate prevents a new feature migration from being marked applied against an
unknown schema baseline. It does not delete or repair any existing data.

## Pre-deploy backup record

Record the following in the release ticket before the production migration:

| Field | Required value |
| --- | --- |
| Backup destination | Immutable NAS/S3 path, not a local temporary directory |
| Retention | Explicit duration and deletion owner |
| Encryption owner | Person/team that controls the recovery key |
| Restore operator | Person who performed an isolated restore test |
| Schema checksum | SHA-256 of the schema dump and recovered migration files |
| Restore evidence | Timestamp and reconciliation result |

## Migration deployment

After the production gate is approved:

```bash
supabase db push --linked
```

Apply the migrations in their committed order. The itinerary projection is
idempotent: it only fills a null `trip_itinerary_items.activity_id`; it never
deletes a trip field or moves itinerary data.

## Reconciliation

Immediately after deployment, run as a privileged release operator:

```sql
select *
from public.activity_trip_reconciliation
where unlinked_item_count <> 0;
```

Expected result: no rows for journeys whose itinerary items have been
projected. Investigate rows before enabling Activity Graph navigation for that
journey. Do not manually rewrite itinerary rows to force a zero result.

## Security acceptance checklist

- [ ] No unexpected rows in `activity_trip_reconciliation`.
- [ ] Private activity is absent from Explore, public API, map, and public join preview.
- [ ] Public published activity is discoverable without private resources.
- [ ] Raw registration tokens do not appear in database queries or logs.
- [ ] Existing trip route, web Google Map/Apple Maps action, and iOS MapKit/Google link still work.
- [ ] Backup destination, retention, encryption owner, and restore operator are approved.

## Browser smoke test

In authenticated staging, verify:

1. `/trips` still opens an existing trip and itinerary/map actions work.
2. `/activities` opens My Feed, Group, and Explore scopes.
3. A private item appears only for its owner/participant; it never appears in
   Explore.
4. Create one registration link, join once while signed in, then confirm the
   second join reports `joined: false` and does not consume another use.
5. The Kyushu trip keeps its existing Google Map in-page behavior and its Apple
   Maps action still opens Apple Maps first.

## Rollback

Do not drop Activity Graph tables during an incident. Disable the Activities
navigation/API feature at the application layer, keep legacy `/trips` live,
and restore from the approved backup only if a data-restoration incident is
declared. The additive links use `ON DELETE SET NULL` so a future controlled
removal does not delete legacy itinerary items.
