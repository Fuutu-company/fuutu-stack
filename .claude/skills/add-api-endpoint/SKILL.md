---
name: add-api-endpoint
description: Use when the user wants a new API endpoint, backend operation, server action or webhook-free integration point that the app or external clients call.
metadata:
  fuutu-source: mcp
  fuutu-category: blueprint
---

# Add an API endpoint

The full, version-matched blueprint is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "add-api-endpoint" }` and follow the returned instructions.
2. Otherwise follow the minimal path below; copy the closest existing procedure in `packages/api/src/modules/*/procedures/`.

## Minimal path (without MCP)

1. Zod input schema — never trust raw input.
2. `authProcedure({ systemPermission | org: { permission } })` for protected data; public only when intentional.
3. `createRateLimitMiddleware(...)` on every mutation.
4. `.route({ method, path, tags, summary })` so it appears in `/api/docs`.
5. Register in the module router and `packages/api/src/orpc/router.ts`.
6. Test in `packages/api/src/__tests__/`, then `pnpm check && pnpm check-types && pnpm test`.
