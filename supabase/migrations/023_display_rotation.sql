-- 023_display_rotation.sql
-- Store per-document display rotation so reviewers can save the corrected orientation.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS display_rotation smallint NOT NULL DEFAULT 0
  CHECK (display_rotation IN (0, 90, 180, 270));
