---
name: add-api-endpoint
description: Use when the user wants a new API endpoint, MCP tool, backend operation, server action or webhook-free integration point that the app, external clients or AI agents call.
metadata:
  fuutu-source: mcp
  fuutu-category: blueprint
---

# Add an API endpoint

The full, version-matched blueprint is served by the **Fuutu MCP** server (Fuutu Pro).

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "add-api-endpoint" }` and follow the returned instructions. Without a Fuutu Pro key it returns an upgrade notice — then continue with step 2.
2. Otherwise follow the minimal path below; copy the closest existing procedure in `packages/api/src/modules/*/procedures/`.

## Minimal path (without MCP)

1. Zod input schema — never trust raw input.
2. `authProcedure({ systemPermission | org: { permission } })` (`packages/api/src/orpc/procedures.ts`) for protected data; public only when intentional. System-admin procedures: `systemAdminProcedure(permission)`. Payments, API-key, webhook and org mutations: `denyImpersonation`.
3. `createRateLimitMiddleware(...)` on every mutation.
4. `.route({ method, path, tags, summary })` so it appears in `/api/docs`.
5. Register in the module router and `packages/api/src/orpc/router.ts`.
6. Test in `packages/api/src/__tests__/`, then `pnpm check && pnpm check-types && pnpm test`.

An MCP tool instead of (or next to) a procedure: `defineMcpTool` from `@fuutu/mcp` with `access: "public" | "authenticated" | (principal) => boolean`, registered in `packages/api/src/mcp/index.ts`.
