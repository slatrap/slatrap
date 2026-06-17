-- Add fingerprint columns to external_errors
ALTER TABLE "external_errors"
  ADD COLUMN "fingerprint" TEXT,
  ADD COLUMN "fingerprint_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "environment" TEXT;

-- New rows will have fingerprint set automatically.
-- Existing rows are left as-is (fingerprint IS NULL) and will not be
-- grouped by fingerprint — they continue to be visible in the DB but
-- are excluded from fingerprint-based dedup queries.

-- CreateIndex
CREATE INDEX "external_errors_fingerprint_last_seen_at_idx"
  ON "external_errors"("fingerprint", "last_seen_at" DESC);
