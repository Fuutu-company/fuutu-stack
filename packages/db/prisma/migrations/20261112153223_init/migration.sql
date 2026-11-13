-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "auth";

-- CreateEnum
CREATE TYPE "app"."PurchaseType" AS ENUM ('SUBSCRIPTION', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "app"."PurchaseStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'SCHEDULED_CANCEL', 'PAUSED', 'CANCELED', 'EXPIRED', 'INCOMPLETE');

-- CreateTable
CREATE TABLE "app"."purchase" (
    "id" TEXT NOT NULL,
    "type" "app"."PurchaseType" NOT NULL,
    "status" "app"."PurchaseStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "productId" TEXT,
    "subscriptionId" TEXT,
    "customerId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "currentPeriodEnd" TIMESTAMP(3),
    "userId" TEXT,
    "organizationId" TEXT,
    "metadata" JSONB,
    "checkoutEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."audit_log" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "action" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."api_key" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."invoice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "providerInvoiceId" TEXT,
    "url" TEXT,
    "pdfUrl" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."webhook" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."webhook_delivery" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "responseCode" INTEGER,
    "responseBody" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."cron_job_run" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL,
    "lastStatus" TEXT NOT NULL,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cron_job_run_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."chat_conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."chat_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'lead',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."credit_balance" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "meterKey" TEXT NOT NULL,
    "recurringGranted" INTEGER NOT NULL DEFAULT 0,
    "recurringConsumed" INTEGER NOT NULL DEFAULT 0,
    "recurringPeriodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."credit_package" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "meterKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "consumed" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "purchaseId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."credit_event" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "organizationId" TEXT,
    "meterKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "packageId" TEXT,
    "reason" TEXT NOT NULL,
    "metadata" JSONB,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "locale" TEXT,
    "twoFactorEnabled" BOOLEAN DEFAULT false,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "username" TEXT,
    "displayUsername" TEXT,
    "paymentsCustomerId" TEXT,
    "lastActiveOrganizationId" TEXT,
    "userCreatedEventSent" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "metadata" TEXT,
    "paymentsCustomerId" TEXT,

    CONSTRAINT "organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."member" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "aaguid" TEXT,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."rate_limit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rate_limit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."two_factor" (
    "id" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "backupCodes" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT true,
    "failedVerificationCount" INTEGER DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),

    CONSTRAINT "two_factor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."jwks" (
    "id" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "privateKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "alg" TEXT,
    "crv" TEXT,

    CONSTRAINT "jwks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_client" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecret" TEXT,
    "clientDiscoveryId" TEXT,
    "disabled" BOOLEAN DEFAULT false,
    "skipConsent" BOOLEAN,
    "enableEndSession" BOOLEAN,
    "subjectType" TEXT,
    "scopes" TEXT[],
    "clientCredentialsScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userId" TEXT,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "name" TEXT,
    "uri" TEXT,
    "icon" TEXT,
    "contacts" TEXT[],
    "tos" TEXT,
    "policy" TEXT,
    "softwareId" TEXT,
    "softwareVersion" TEXT,
    "softwareStatement" TEXT,
    "redirectUris" TEXT[],
    "postLogoutRedirectUris" TEXT[],
    "backchannelLogoutUri" TEXT,
    "backchannelLogoutSessionRequired" BOOLEAN,
    "tokenEndpointAuthMethod" TEXT,
    "applicationType" TEXT,
    "jwks" TEXT,
    "jwksUri" TEXT,
    "grantTypes" TEXT[],
    "responseTypes" TEXT[],
    "requirePKCE" BOOLEAN,
    "dpopBoundAccessTokens" BOOLEAN DEFAULT false,
    "referenceId" TEXT,
    "metadata" TEXT,

    CONSTRAINT "oauth_client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_resource" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessTokenTtl" INTEGER,
    "refreshTokenTtl" INTEGER,
    "signingAlgorithm" TEXT,
    "signingKeyId" TEXT,
    "allowedScopes" TEXT[],
    "customClaims" TEXT,
    "dpopBoundAccessTokensRequired" BOOLEAN DEFAULT false,
    "disabled" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),
    "policyVersion" INTEGER DEFAULT 1,
    "metadata" TEXT,

    CONSTRAINT "oauth_resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_client_resource" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3),

    CONSTRAINT "oauth_client_resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_refresh_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT NOT NULL,
    "referenceId" TEXT,
    "authorizationCodeId" TEXT,
    "resources" TEXT[],
    "requestedUserInfoClaims" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "revoked" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "rotationReplayResponse" TEXT,
    "rotationReplayExpiresAt" TIMESTAMP(3),
    "authTime" TIMESTAMP(3),
    "confirmation" TEXT,
    "scopes" TEXT[],

    CONSTRAINT "oauth_refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_access_token" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "referenceId" TEXT,
    "authorizationCodeId" TEXT,
    "resources" TEXT[],
    "requestedUserInfoClaims" TEXT[],
    "refreshId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "revoked" TIMESTAMP(3),
    "confirmation" TEXT,
    "scopes" TEXT[],

    CONSTRAINT "oauth_access_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_consent" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "referenceId" TEXT,
    "resources" TEXT[],
    "requestedUserInfoClaims" TEXT[],
    "scopes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."oauth_client_assertion" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "oauth_client_assertion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "purchase_userId_idx" ON "app"."purchase"("userId");

-- CreateIndex
CREATE INDEX "purchase_organizationId_idx" ON "app"."purchase"("organizationId");

-- CreateIndex
CREATE INDEX "purchase_status_idx" ON "app"."purchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_provider_subscriptionId_key" ON "app"."purchase"("provider", "subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_provider_checkoutEventId_key" ON "app"."purchase"("provider", "checkoutEventId") WHERE ("checkoutEventId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "audit_log_userId_idx" ON "app"."audit_log"("userId");

-- CreateIndex
CREATE INDEX "audit_log_organizationId_idx" ON "app"."audit_log"("organizationId");

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "app"."audit_log"("action");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "app"."audit_log"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_key_key" ON "app"."api_key"("key");

-- CreateIndex
CREATE INDEX "api_key_userId_idx" ON "app"."api_key"("userId");

-- CreateIndex
CREATE INDEX "api_key_organizationId_idx" ON "app"."api_key"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "invoice_providerInvoiceId_key" ON "app"."invoice"("providerInvoiceId");

-- CreateIndex
CREATE INDEX "invoice_organizationId_idx" ON "app"."invoice"("organizationId");

-- CreateIndex
CREATE INDEX "invoice_userId_idx" ON "app"."invoice"("userId");

-- CreateIndex
CREATE INDEX "invoice_status_idx" ON "app"."invoice"("status");

-- CreateIndex
CREATE INDEX "webhook_organizationId_idx" ON "app"."webhook"("organizationId");

-- CreateIndex
CREATE INDEX "webhook_delivery_webhookId_idx" ON "app"."webhook_delivery"("webhookId");

-- CreateIndex
CREATE INDEX "webhook_delivery_status_idx" ON "app"."webhook_delivery"("status");

-- CreateIndex
CREATE INDEX "webhook_delivery_nextRetryAt_idx" ON "app"."webhook_delivery"("nextRetryAt");

-- CreateIndex
CREATE UNIQUE INDEX "cron_job_run_jobKey_key" ON "app"."cron_job_run"("jobKey");

-- CreateIndex
CREATE INDEX "notification_userId_idx" ON "app"."notification"("userId");

-- CreateIndex
CREATE INDEX "notification_readAt_idx" ON "app"."notification"("readAt");

-- CreateIndex
CREATE INDEX "notification_createdAt_idx" ON "app"."notification"("createdAt");

-- CreateIndex
CREATE INDEX "chat_conversation_userId_idx" ON "app"."chat_conversation"("userId");

-- CreateIndex
CREATE INDEX "chat_conversation_organizationId_idx" ON "app"."chat_conversation"("organizationId");

-- CreateIndex
CREATE INDEX "chat_message_conversationId_idx" ON "app"."chat_message"("conversationId");

-- CreateIndex
CREATE INDEX "contact_organizationId_idx" ON "app"."contact"("organizationId");

-- CreateIndex
CREATE INDEX "contact_status_idx" ON "app"."contact"("status");

-- CreateIndex
CREATE INDEX "credit_balance_userId_idx" ON "app"."credit_balance"("userId");

-- CreateIndex
CREATE INDEX "credit_balance_organizationId_idx" ON "app"."credit_balance"("organizationId");

-- CreateIndex
CREATE INDEX "credit_balance_meterKey_idx" ON "app"."credit_balance"("meterKey");

-- CreateIndex
CREATE UNIQUE INDEX "credit_balance_userId_organizationId_meterKey_key" ON "app"."credit_balance"("userId", "organizationId", "meterKey");

-- CreateIndex
CREATE UNIQUE INDEX "credit_balance_user_meter_key" ON "app"."credit_balance"("userId", "meterKey") WHERE ("userId" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "credit_balance_organization_meter_key" ON "app"."credit_balance"("organizationId", "meterKey") WHERE ("organizationId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "credit_package_userId_idx" ON "app"."credit_package"("userId");

-- CreateIndex
CREATE INDEX "credit_package_organizationId_idx" ON "app"."credit_package"("organizationId");

-- CreateIndex
CREATE INDEX "credit_package_meterKey_idx" ON "app"."credit_package"("meterKey");

-- CreateIndex
CREATE INDEX "credit_package_expiresAt_idx" ON "app"."credit_package"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_package_purchaseId_key" ON "app"."credit_package"("purchaseId") WHERE ("purchaseId" IS NOT NULL);

-- CreateIndex
CREATE INDEX "credit_event_userId_idx" ON "app"."credit_event"("userId");

-- CreateIndex
CREATE INDEX "credit_event_organizationId_idx" ON "app"."credit_event"("organizationId");

-- CreateIndex
CREATE INDEX "credit_event_meterKey_idx" ON "app"."credit_event"("meterKey");

-- CreateIndex
CREATE INDEX "credit_event_packageId_idx" ON "app"."credit_event"("packageId");

-- CreateIndex
CREATE INDEX "credit_event_createdAt_idx" ON "app"."credit_event"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_event_user_idempotency_key" ON "app"."credit_event"("userId", "meterKey", "idempotencyKey") WHERE ("userId" IS NOT NULL AND "idempotencyKey" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "credit_event_organization_idempotency_key" ON "app"."credit_event"("organizationId", "meterKey", "idempotencyKey") WHERE ("organizationId" IS NOT NULL AND "idempotencyKey" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "auth"."user"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "auth"."user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "auth"."session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "auth"."session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "auth"."account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "auth"."verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "organization_slug_key" ON "auth"."organization"("slug");

-- CreateIndex
CREATE INDEX "member_organizationId_idx" ON "auth"."member"("organizationId");

-- CreateIndex
CREATE INDEX "member_userId_idx" ON "auth"."member"("userId");

-- CreateIndex
CREATE INDEX "invitation_organizationId_idx" ON "auth"."invitation"("organizationId");

-- CreateIndex
CREATE INDEX "invitation_email_idx" ON "auth"."invitation"("email");

-- CreateIndex
CREATE INDEX "passkey_userId_idx" ON "auth"."passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_key_key" ON "auth"."rate_limit"("key");

-- CreateIndex
CREATE INDEX "two_factor_userId_idx" ON "auth"."two_factor"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_client_clientId_key" ON "auth"."oauth_client"("clientId");

-- CreateIndex
CREATE INDEX "oauth_client_userId_idx" ON "auth"."oauth_client"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_resource_identifier_key" ON "auth"."oauth_resource"("identifier");

-- CreateIndex
CREATE INDEX "oauth_client_resource_clientId_idx" ON "auth"."oauth_client_resource"("clientId");

-- CreateIndex
CREATE INDEX "oauth_client_resource_resourceId_idx" ON "auth"."oauth_client_resource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_client_resource_clientId_resourceId_key" ON "auth"."oauth_client_resource"("clientId", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_refresh_token_token_key" ON "auth"."oauth_refresh_token"("token");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_clientId_idx" ON "auth"."oauth_refresh_token"("clientId");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_sessionId_idx" ON "auth"."oauth_refresh_token"("sessionId");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_userId_idx" ON "auth"."oauth_refresh_token"("userId");

-- CreateIndex
CREATE INDEX "oauth_refresh_token_authorizationCodeId_idx" ON "auth"."oauth_refresh_token"("authorizationCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_access_token_token_key" ON "auth"."oauth_access_token"("token");

-- CreateIndex
CREATE INDEX "oauth_access_token_clientId_idx" ON "auth"."oauth_access_token"("clientId");

-- CreateIndex
CREATE INDEX "oauth_access_token_sessionId_idx" ON "auth"."oauth_access_token"("sessionId");

-- CreateIndex
CREATE INDEX "oauth_access_token_userId_idx" ON "auth"."oauth_access_token"("userId");

-- CreateIndex
CREATE INDEX "oauth_access_token_authorizationCodeId_idx" ON "auth"."oauth_access_token"("authorizationCodeId");

-- CreateIndex
CREATE INDEX "oauth_access_token_refreshId_idx" ON "auth"."oauth_access_token"("refreshId");

-- CreateIndex
CREATE INDEX "oauth_consent_clientId_idx" ON "auth"."oauth_consent"("clientId");

-- CreateIndex
CREATE INDEX "oauth_consent_userId_idx" ON "auth"."oauth_consent"("userId");

-- AddForeignKey
ALTER TABLE "app"."purchase" ADD CONSTRAINT "purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."purchase" ADD CONSTRAINT "purchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."audit_log" ADD CONSTRAINT "audit_log_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."api_key" ADD CONSTRAINT "api_key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."api_key" ADD CONSTRAINT "api_key_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."invoice" ADD CONSTRAINT "invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."invoice" ADD CONSTRAINT "invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."webhook" ADD CONSTRAINT "webhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."webhook_delivery" ADD CONSTRAINT "webhook_delivery_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "app"."webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."chat_conversation" ADD CONSTRAINT "chat_conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."chat_conversation" ADD CONSTRAINT "chat_conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."chat_message" ADD CONSTRAINT "chat_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "app"."chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."contact" ADD CONSTRAINT "contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_balance" ADD CONSTRAINT "credit_balance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_balance" ADD CONSTRAINT "credit_balance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_package" ADD CONSTRAINT "credit_package_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_package" ADD CONSTRAINT "credit_package_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_package" ADD CONSTRAINT "credit_package_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "app"."purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_event" ADD CONSTRAINT "credit_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_event" ADD CONSTRAINT "credit_event_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."credit_event" ADD CONSTRAINT "credit_event_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "app"."credit_package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."member" ADD CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "auth"."organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."invitation" ADD CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."two_factor" ADD CONSTRAINT "two_factor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_client" ADD CONSTRAINT "oauth_client_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "auth"."oauth_client"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_client_resource" ADD CONSTRAINT "oauth_client_resource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "auth"."oauth_resource"("identifier") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "auth"."oauth_client"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auth"."session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_refresh_token" ADD CONSTRAINT "oauth_refresh_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "auth"."oauth_client"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "auth"."session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_access_token" ADD CONSTRAINT "oauth_access_token_refreshId_fkey" FOREIGN KEY ("refreshId") REFERENCES "auth"."oauth_refresh_token"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_consent" ADD CONSTRAINT "oauth_consent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "auth"."oauth_client"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."oauth_consent" ADD CONSTRAINT "oauth_consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
