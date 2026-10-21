-- AlterTable
ALTER TABLE "auth"."user" ADD COLUMN     "userCreatedEventSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "auth"."rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "auth"."rate_limit"("key");
