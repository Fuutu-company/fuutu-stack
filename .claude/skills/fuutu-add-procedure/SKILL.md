---
name: fuutu-add-procedure
description: Adds a type-safe API endpoint on the Fuutu Stack — oRPC procedure with Zod input, auth/RBAC guard, rate limit, OpenAPI route and test. Use when the user wants a new API endpoint, server action or backend operation.
metadata:
  fuutu-source: mcp
  fuutu-category: blueprint
---

# Add an API procedure

Full, version-matched blueprint is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "fuutu-add-procedure" }` and follow the returned instructions exactly.
2. Otherwise use the minimal path below; copy the closest existing procedure in `packages/api/src/modules/*/procedures/`.

## Minimal path (no MCP)

1. Zod input schema; never trust raw input.
2. `authProcedure({ systemPermission | org: { permission } })` for protected data; public only when intentional.
3. `createRateLimitMiddleware(...)` on every mutation.
4. `.route({ method, path, tags, summary })` so it appears in `/api/docs`.
5. Register in the module router and `packages/api/src/orpc/router.ts`.
6. Test in `packages/api/src/__tests__/`, then `pnpm check && pnpm check-types && pnpm test`.
