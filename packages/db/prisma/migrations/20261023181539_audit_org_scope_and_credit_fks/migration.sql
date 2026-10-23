-- AlterTable
ALTER TABLE "app"."audit_log" ADD COLUMN     "organizationId" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_organizationId_idx" ON "app"."audit_log"("organizationId");

-- AddForeignKey
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_package" ADD CONSTRAINT "credit_package_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "app"."purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_event" ADD CONSTRAINT "credit_event_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "app"."credit_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "credit_event_packageId_idx" ON "app"."credit_event"("packageId");

-- Backfill
-- Older rows stashed org scope in metadata->>'orgId' (the pre-column
-- convention); promote it onto the new organizationId column.
UPDATE "app"."audit_log"
SET "organizationId" = "metadata"->>'orgId'
WHERE "organizationId" IS NULL
  AND "metadata"->>'orgId' IS NOT NULL
  AND "metadata"->>'orgId' <> '';
