---
name: swap-provider
description: Use when the user wants to switch or add a provider for mail, payments, storage, analytics, logs or AI — e.g. "use Resend instead of Plunk", "move to Stripe", "add a custom storage provider".
metadata:
  fuutu-source: mcp
  fuutu-category: integration
---

# Swap or add a provider

The full, provider-specific guide is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "swap-provider" }` and follow the returned instructions.
2. Otherwise follow the minimal path below.

## Minimal path (without MCP)

1. Read the domain's provider interface (`packages/<domain>/src/types.ts`) and an existing implementation (usually `packages/<domain>/src/providers/`).
2. Select the provider in `packages/<domain>/src/config.ts` (mail: `src/config/` + `resolve.ts`) — callers keep importing from `@fuutu/<domain>` only.
3. New env vars go through `packages/env/src/` (Zod) and `.env.example` — never `process.env` directly.
4. Tests in `packages/<domain>/src/__tests__/`, then `pnpm check && pnpm check-types && pnpm test`.
