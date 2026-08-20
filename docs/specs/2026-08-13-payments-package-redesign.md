# Payments Package Redesign

> Date: 2026-08-13
> Status: approved
> Scope: `packages/payments/`, `packages/db/`, `packages/auth/`, `packages/api/`, `packages/env/`

## Problem

The current `@fuutu/payments` has a parallel-systems problem:
- `@fuutu/payments/providers/polar.ts` calls the raw Polar SDK
- `@fuutu/auth` separately mounts `@polar-sh/better-auth` (BA plugin)
- The Fuutu-owned `Purchase` table is never populated from BA webhook events
- Skeleton providers (Stripe, Creem, etc.) all throw

Better Auth's payment plugins are unsuitable as the foundation for a modular framework:
- Each plugin has a different client API (`upgrade` vs `checkout` vs `attach` vs `checkoutSession`)
- Each plugin creates its own DB tables (`stripe_subscription`, `creem_subscription`, etc.)
- No uniform session field for subscription status
- Usage-based billing only works with 3/7 plugins

## Decision

**Own layer, not BA-first.** We own the full payment lifecycle through a unified `PaymentProvider` interface. Provider SDKs are called directly. Our `Purchase` table is the single source of truth. BA is decoupled — no BA payment plugin is mounted; only BA organization hooks remain for seat-sync triggers.

## Architecture

```
App / UI / API
    ↓ calls only @fuutu/payments + @fuutu/db
@fuutu/payments
    PaymentProvider interface (the contract)
        ├── stripeProvider  (stripe SDK)
        ├── creemProvider   (fetch API)
        ├── polarProvider   (@polar-sh/sdk)
        └── customProvider  (user implementation)
    WebhookSync (shared, provider-agnostic)
        ProviderEvent[] → Purchase table
    PLANS / LIMITS / FEATURE_CATALOG / buildPricingTiers (unchanged)
    ↓ writes/reads
@fuutu/db — Purchase table (one schema for ALL providers)
    ↓ triggers seat-sync
@fuutu/auth — organization hooks only (no BA payment plugin)
```

## PaymentProvider Interface

```typescript
type ProviderEventType =
  | "checkout.completed"
  | "subscription.activated"
  | "subscription.renewed"
  | "subscription.updated"
  | "subscription.past_due"
  | "subscription.paused"
  | "subscription.scheduled_cancel"
  | "subscription.canceled"
  | "subscription.expired"
  | "one_time.purchased";

interface ProviderEvent {
  type: ProviderEventType;
  subscriptionId?: string;
  customerId?: string;
  productId?: string;
  status?: PurchaseStatus;
  currentPeriodEnd?: Date;
  metadata?: Record<string, unknown>;
}

interface PaymentProvider {
  readonly id: string;
  readonly ownsSeatSync?: boolean;
  createCheckoutLink(input: CheckoutInput): Promise<{ url: string }>;
  createCustomerPortalLink(input: PortalInput): Promise<{ url: string }>;
  createCustomer(input: CustomerInput): Promise<{ customerId: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  parseWebhook(request: Request): Promise<ProviderEvent[]>;
}

interface SeatAwarePaymentProvider extends PaymentProvider {
  setSubscriptionSeats(input: { subscriptionId: string; seats: number }): Promise<void>;
}
```

### What we do NOT do

- No invoice management in the payments package (provider portal handles it)
- No active subscription status polling (webhooks are sufficient)
- No trial date fields (status enum covers it)
- No BA payment plugin mounted
- No provider-specific DB tables (one `Purchase` table for all)
- No `webhookHandler` in the interface — framework owns the HTTP entry, provider only parses

## Webhook Flow

```
HTTP Request → webhookHandler (shared, framework)
    → provider.parseWebhook(request)     ← provider verifies signature + parses
    → ProviderEvent[] (normalized)
    → sync.processEvents(events)         ← shared business logic
    → Purchase table updated
```

Provider implements only: signature verification + payload parsing → `ProviderEvent[]`.
Framework owns: HTTP entry, status machine, old-subscription cancellation on upgrade, protected-status logic.

## DB Schema Changes

### PurchaseStatus enum — add 2 values

```
SCHEDULED_CANCEL  // canceled but still active until period end
PAUSED            // paused (dunning or customer request)
```

### Purchase model — add 1 field

```
currentPeriodEnd  DateTime?   // from webhook, for "renews on X" UI
```

No other changes. No trial fields, no cancelAtPeriodEnd, no UsageEvent table.

## File Structure

```
packages/payments/src/
  config.ts        ← PLANS/LIMITS/FEATURE_CATALOG (minimal changes: add "custom" provider id)
  types.ts         ← interface + ProviderEvent (rewritten)
  plans.ts         ← buildPricingTiers (unchanged)
  features.ts      ← unchanged
  resolve.ts       ← provider resolution (updated)
  webhook.ts       ← shared HTTP entry (rewritten: parseWebhook + sync)
  sync.ts          ← shared ProviderEvent → Purchase (new)
  seats.ts         ← seat-sync helper (updated for new interface)
  customers.ts     ← createCustomerOnSignUp helper (new)
  providers/
    stripe.ts      ← Stripe (new)
    creem.ts       ← Creem (new, based on user's example)
    polar.ts       ← Polar (refactored to new interface)
    skeleton.ts    ← skeleton factory (updated)
```

## Providers to implement

1. **Stripe** — using `stripe` SDK, Checkout Sessions API, Customer Portal, webhook signature verification
2. **Creem** — using fetch API (or `creem` SDK), based on user's working example
3. **Polar** — refactored from current to new interface
4. **Custom** — skeleton that users implement

## Auth Package Changes

- Remove `@polar-sh/better-auth` plugin mount from `packages/auth/src/index.ts`
- Remove `packages/auth/src/lib/payments.ts` (polarClient)
- Add `user.create.after` hook → `createCustomerForUser()` from `@fuutu/payments`
- Keep organization hooks (seat-sync, cancel-on-delete) — they call `@fuutu/payments`

## Env Vars

Add to `packages/env/src/saas.ts`:
```
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_*
CREEM_API_KEY, CREEM_WEBHOOK_SECRET, CREEM_TEST_MODE
```

## Testing

- Unit tests for `sync.ts` (status machine, protected statuses, old-sub cancel)
- Unit tests for `types.ts` (interface compliance)
- Unit tests for each provider (mocked SDK calls)
- Playwright E2E: checkout flow, billing portal redirect, pricing page
