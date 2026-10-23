-- Consume idempotency key on credit_event. The ALTER TABLE comes from
-- `prisma migrate diff`; the partial unique indexes cannot be expressed in
-- the .prisma schema — raw SQL only, same pattern as
-- credit_package."purchaseId" in 20260925114500_credit_owner_constraints.

-- AlterTable
ALTER TABLE "app"."credit_event" ADD COLUMN     "idempotencyKey" TEXT;

-- One consume per idempotency key per owner+meter — makes a redelivered
-- consume request (e.g. retried webhook or client retry) replay the
-- original result instead of debiting again. Two partial indexes because
-- the owner XOR CHECK leaves the other owner column NULL and Postgres
-- treats NULLs as distinct (same trap documented in
-- 20260925114500_credit_owner_constraints for credit_balance).
-- Only the first event of a consume carries the key, so a multi-event
-- consume does not self-violate.
CREATE UNIQUE INDEX "credit_event_user_idempotency_key"
    ON "app"."credit_event" ("userId", "meterKey", "idempotencyKey")
    WHERE "userId" IS NOT NULL AND "idempotencyKey" IS NOT NULL;

CREATE UNIQUE INDEX "credit_event_organization_idempotency_key"
    ON "app"."credit_event" ("organizationId", "meterKey", "idempotencyKey")
    WHERE "organizationId" IS NOT NULL AND "idempotencyKey" IS NOT NULL;
