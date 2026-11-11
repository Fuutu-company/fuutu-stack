---
name: connect-payments
description: Use when the user wants to go live with billing or connect a real Creem, Stripe or Polar account — products, prices, webhooks, checkout.
metadata:
  fuutu-source: mcp
  fuutu-category: integration
---

# Connect a payments account

The full, provider-specific walkthrough is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "connect-payments" }` and follow the returned instructions.
2. Otherwise follow the minimal path below.

## Minimal path (without MCP)

1. Plans live only in `PLANS` / `FEATURE_CATALOG` / `LIMITS` (`packages/payments/src/config.ts`); map the provider's price/product ids via env (`PAYMENTS_*_PRICE_ID`).
2. Webhook endpoint: `POST /api/webhooks/payments` — set the provider's signing secret env var; never bypass signature checks.
3. Run a checkout in the provider's test mode and confirm the plan change in the app.
