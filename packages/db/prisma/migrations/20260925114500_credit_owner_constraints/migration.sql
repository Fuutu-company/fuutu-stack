-- Polymorphic owner invariant: exactly one of "userId"/"organizationId"
-- must be set on owner-scoped tables. Prisma cannot express CHECK
-- constraints or partial unique indexes — this migration is raw SQL only;
-- do not mirror it in the .prisma schema.

ALTER TABLE "app"."credit_balance"
    ADD CONSTRAINT "credit_balance_owner_xor"
    CHECK (("userId" IS NULL) <> ("organizationId" IS NULL));

ALTER TABLE "app"."credit_package"
    ADD CONSTRAINT "credit_package_owner_xor"
    CHECK (("userId" IS NULL) <> ("organizationId" IS NULL));

ALTER TABLE "app"."purchase"
    ADD CONSTRAINT "purchase_owner_xor"
    CHECK (("userId" IS NULL) <> ("organizationId" IS NULL));

-- Per-owner uniqueness on credit_balance. The schema's
-- @@unique([userId, organizationId, meterKey]) is void when one owner is
-- NULL (Postgres treats NULLs as distinct) — these partial indexes give
-- the real "one balance per owner+meter" guarantee the find-then-create
-- paths rely on.
CREATE UNIQUE INDEX "credit_balance_user_meter_key"
    ON "app"."credit_balance" ("userId", "meterKey")
    WHERE "userId" IS NOT NULL;

CREATE UNIQUE INDEX "credit_balance_organization_meter_key"
    ON "app"."credit_balance" ("organizationId", "meterKey")
    WHERE "organizationId" IS NOT NULL;

-- One credit package per purchase — makes top-up credit grants
-- idempotent under webhook redelivery.
CREATE UNIQUE INDEX "credit_package_purchaseId_key"
    ON "app"."credit_package" ("purchaseId")
    WHERE "purchaseId" IS NOT NULL;

-- Idempotency marker for one-time checkouts: webhook sync stores the
-- provider event id in purchase.metadata->>'checkoutEventId'; this
-- expression index makes a redelivered checkout.completed a no-op.
CREATE UNIQUE INDEX "purchase_provider_checkoutEventId_key"
    ON "app"."purchase" ("provider", (("metadata" ->> 'checkoutEventId')))
    WHERE ("metadata" ->> 'checkoutEventId') IS NOT NULL;
