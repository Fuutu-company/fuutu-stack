-- better-auth 1.7 plugin schema additions:
--   username()  → "user"."displayUsername"      (display form, keeps normalized username unique)
--   twoFactor() → failedVerificationCount / lockedUntil  (TOTP brute-force lockout)
-- Missing these columns triggers BetterAuthError("Prisma schema mismatch")
-- at runtime on every auth endpoint.

-- AlterTable
ALTER TABLE "auth"."two_factor" ADD COLUMN     "failedVerificationCount" INTEGER DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "auth"."user" ADD COLUMN     "displayUsername" TEXT;
