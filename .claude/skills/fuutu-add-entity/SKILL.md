---
name: fuutu-add-entity
description: Adds a new data entity end-to-end on the Fuutu Stack — Prisma model + migration, query functions, Zod schemas, oRPC procedures with RBAC, i18n keys (all locales) and tests. Use when the user wants a new table, model, resource or CRUD feature.
metadata:
  fuutu-source: mcp
  fuutu-category: blueprint
---

# Add an entity

Full, version-matched blueprint is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "fuutu-add-entity" }` and follow the returned instructions exactly.
2. Otherwise use the minimal path below and read each referenced file before editing.

## Minimal path (no MCP)

1. Model in `packages/db/prisma/schema/app.prisma` (`@@schema("app")`), then `pnpm db:migrate`.
2. Query functions in `packages/db/prisma/queries/<entity>.ts`, exported from `queries/index.ts` — callers never touch the raw client.
3. Procedures in `packages/api/src/modules/<entity>/procedures/` (Zod input, `authProcedure` with an RBAC permission from `packages/rbac/src/permissions.ts`), router registered in `packages/api/src/orpc/router.ts`.
4. UI in `apps/saas/src/modules/app/<entity>/`, strings in `packages/i18n/translations/<locale>/saas/` for every locale.
5. Tests: `packages/api/src/__tests__/<entity>.test.ts` (+ IDOR case for org-scoped data), E2E in `apps/saas/tests/`.
6. Gates: `pnpm check && pnpm check-types && pnpm test`.
