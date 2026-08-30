-- ═══════════════════════════════════════════════════════════════════════════
-- 20260824160000_trip_documents_photos_checkin.sql
--
-- Three additions, all additive — nothing here touches an existing table's
-- constraints or policies:
--   1. Check-in state on trip_itinerary_items (two nullable columns).
--   2. trip_documents — a browsable file library per trip (itinerary scans,
--      passport, visa, insurance, tickets, hotel confirmations). Deliberately
--      its OWN table rather than an extension of the shared `documents` table:
--      that table's CHECK constraints and workflow columns (doc_type IN
--      ('expense','invoice','receipt','unknown'), WHT/VAT fields, duplicate
--      detection, OCR review states) belong to the accounting pipeline and
--      have nothing to do with a passport scan.
--   3. trip_photos — check-in photos / a trip gallery, one row per photo,
--      optionally tied to a specific itinerary item.
--
-- Both new tables reuse is_trip_participant() (094_trip_participant_scoped_rls.sql),
-- the same authorization already trusted for 8 other trip child tables.
--
-- SENSITIVITY SPLIT, matching existing precedent rather than inventing one:
-- 076_chat_attachments_bucket.sql's own comment says the shared "documents"
-- bucket is PRIVATE specifically because it holds sensitive receipts/invoices,
-- while casual attachments (chat-attachments, avatars, payment-proofs) get
-- their own PUBLIC, obscure-path buckets. A passport or insurance scan sits
-- with the former; a check-in snapshot sits with the latter.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Check-in state ─────────────────────────────────────────────────────
ALTER TABLE trip_itinerary_items
  ADD COLUMN checked_in_at timestamptz,
  ADD COLUMN checked_in_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- ── 2. Document library ───────────────────────────────────────────────────
CREATE TABLE trip_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES life_journeys(id) ON DELETE CASCADE,
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  kind         text NOT NULL DEFAULT 'other'
               CHECK (kind IN ('itinerary','passport','visa','insurance','ticket','hotel','other')),
  title        text NOT NULL,
  -- Path inside the trip-documents bucket, always "{journey_id}/{uuid}.{ext}" —
  -- the storage RLS policy below reads journey_id back out of this path.
  file_path    text NOT NULL,
  file_type    text NOT NULL CHECK (file_type IN ('pdf','jpg','png','heic')),
  file_size    integer,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX idx_trip_documents_journey ON trip_documents(journey_id, created_at DESC);
ALTER TABLE trip_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_documents_participant" ON trip_documents FOR ALL TO authenticated
  USING (is_trip_participant(journey_id));

-- ── 3. Check-in photos / gallery ──────────────────────────────────────────
CREATE TABLE trip_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id   uuid NOT NULL REFERENCES life_journeys(id) ON DELETE CASCADE,
  -- Which stop this was taken at — null for a general trip photo not tied
  -- to any one place.
  item_id      uuid REFERENCES trip_itinerary_items(id) ON DELETE SET NULL,
  uploaded_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  caption      text,
  taken_at     timestamptz DEFAULT now()
);
CREATE INDEX idx_trip_photos_journey ON trip_photos(journey_id, taken_at DESC);
CREATE INDEX idx_trip_photos_item ON trip_photos(item_id) WHERE item_id IS NOT NULL;
ALTER TABLE trip_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trip_photos_participant" ON trip_photos FOR ALL TO authenticated
  USING (is_trip_participant(journey_id));

-- ── Buckets ────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trip-documents', 'trip-documents', false, 15728640) -- 15MB, private
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('trip-photos', 'trip-photos', true, 10485760) -- 10MB, public
ON CONFLICT (id) DO NOTHING;

-- trip-documents: private. A real per-object check, not just an unguessable
-- path — the first path segment is the journey_id, checked against
-- is_trip_participant() on every read/write.
CREATE POLICY "trip_documents_storage" ON storage.objects FOR ALL
  USING (bucket_id = 'trip-documents' AND is_trip_participant(((storage.foldername(name))[1])::uuid));

-- trip-photos: public read, authenticated insert, delete-own — the exact
-- posture 076_chat_attachments_bucket.sql already established for casual
-- attachments.
CREATE POLICY "trip_photos_select_public" ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-photos');
CREATE POLICY "trip_photos_insert_authenticated" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trip-photos');
CREATE POLICY "trip_photos_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'trip-photos' AND owner = auth.uid());
