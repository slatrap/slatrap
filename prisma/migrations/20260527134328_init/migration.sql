-- CreateTable
CREATE TABLE "institution_items" (
    "id" SERIAL NOT NULL,
    "item_id" TEXT NOT NULL,
    "institution_id" TEXT NOT NULL,
    "institution_name" TEXT,

    CONSTRAINT "institution_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_errors" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "requestId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latency" INTEGER NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "count" INTEGER NOT NULL DEFAULT 1,
    "endpoint" TEXT,
    "statusCode" INTEGER,

    CONSTRAINT "external_errors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institution_items_item_id_key" ON "institution_items"("item_id");

-- CreateIndex
CREATE INDEX "external_errors_provider_errorCode_endpoint_statusCode_time_idx" ON "external_errors"("provider", "errorCode", "endpoint", "statusCode", "timestamp" DESC);
