---
name: fuutu-swap-provider
description: Switches or adds a provider in a swappable Fuutu Stack domain (mail, payments, storage, analytics, logs, AI) behind its typed provider interface, including env vars and tests. Use when the user wants to change e.g. Plunk to Resend, Creem to Stripe, or add a custom provider.
metadata:
  fuutu-source: mcp
  fuutu-category: integration
---

# Swap or add a provider

Full, version-matched guide is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "fuutu-swap-provider" }` and follow the returned instructions exactly.
2. Otherwise use the minimal path below.

## Minimal path (no MCP)

1. Read the domain's provider interface (`packages/<domain>/src/types.ts`) and an existing implementation (usually `packages/<domain>/src/providers/`).
2. Select the provider in `packages/<domain>/src/config.ts` (mail: `src/config/` + `resolve.ts`) — callers keep importing from `@fuutu/<domain>` only.
3. New env vars go through `packages/env/src/` (Zod) and `.env.example` — never `process.env` directly.
4. Tests in `packages/<domain>/src/__tests__/`, then `pnpm check && pnpm check-types && pnpm test`.
