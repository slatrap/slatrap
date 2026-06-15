-- CreateTable
CREATE TABLE "latency_observations" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT,
    "latency_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "status_code" INTEGER,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "latency_observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "latency_incidents" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT,
    "threshold_ms" INTEGER NOT NULL,
    "observed_ms" INTEGER NOT NULL,
    "max_latency_ms" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',

    CONSTRAINT "latency_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "latency_observations_provider_endpoint_timestamp_idx" ON "latency_observations"("provider", "endpoint", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "latency_incidents_provider_endpoint_thresholdMs_timestamp_idx" ON "latency_incidents"("provider", "endpoint", "threshold_ms", "timestamp" DESC);
