---
name: fuutu-connect-payments
description: Connects a real payments account (Creem, Stripe, Polar) to the Fuutu Stack — products/prices, plan catalog mapping, webhook endpoint + secret, checkout test. Use when the user wants to go live with billing or set up a payment provider account.
metadata:
  fuutu-source: mcp
  fuutu-category: integration
---

# Connect a payments account

Full, provider-specific walkthrough is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "fuutu-connect-payments" }` and follow the returned instructions exactly.
2. Otherwise use the minimal path below.

## Minimal path (no MCP)

1. Plans live only in `PLANS` / `FEATURE_CATALOG` / `LIMITS` (`packages/payments/src/config.ts`); map provider price/product ids via env (`PAYMENTS_*_PRICE_ID`).
2. Webhook endpoint: `POST /api/webhooks/payments` — set the provider's signing secret env var; never bypass signature checks.
3. Test a checkout in the provider's test mode, then confirm the plan change in the app.
