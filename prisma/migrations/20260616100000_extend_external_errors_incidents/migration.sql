-- AlterTable
ALTER TABLE "external_errors" ADD COLUMN "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "external_errors" ADD COLUMN "severity" TEXT NOT NULL DEFAULT 'medium';

UPDATE "external_errors" SET "last_seen_at" = "timestamp";

-- DropIndex
DROP INDEX IF EXISTS "external_errors_provider_errorCode_endpoint_statusCode_time_idx";

-- CreateIndex
CREATE INDEX "external_errors_provider_errorCode_errorType_endpoint_statusCode_timestamp_idx" ON "external_errors"("provider", "errorCode", "errorType", "endpoint", "statusCode", "timestamp" DESC);
CREATE INDEX "external_errors_provider_severity_last_seen_at_idx" ON "external_errors"("provider", "severity", "last_seen_at" DESC);
