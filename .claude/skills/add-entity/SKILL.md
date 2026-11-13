---
name: add-entity
description: Use when the user wants a new table, data model, resource or CRUD feature (e.g. "add projects", "store invoices", "let users manage tags").
metadata:
  fuutu-source: mcp
  fuutu-category: blueprint
---

# Add an entity

The full, version-matched blueprint is served by the **Fuutu MCP** server (MCP Plus).

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "add-entity" }` and follow the returned instructions. Without an MCP Plus key it returns an upgrade notice — then continue with step 2.
2. Otherwise follow the minimal path below and read each referenced file before editing.

## Minimal path (without MCP)

1. Model in `packages/db/prisma/schema/app.prisma` (`@@schema("app")`), then generate the migration with `pnpm --filter @fuutu/db db:migrate --name add_<entity>`. Never write or edit migration SQL by hand.
2. Query functions in `packages/db/prisma/queries/<entity>.ts`, exported from `queries/index.ts` — callers never touch the raw client.
3. Procedures in `packages/api/src/modules/<entity>/procedures/` (Zod input, `authProcedure` with a permission from `packages/rbac/src/permissions.ts`, rate limit on mutations), router registered in `packages/api/src/orpc/router.ts`.
4. UI in `apps/saas/src/modules/app/<entity>/`; strings in `packages/i18n/translations/<locale>/saas/` for every locale.
5. Tests: `packages/api/src/__tests__/<entity>.test.ts` (incl. another org's id being rejected), E2E in `apps/saas/tests/`.
6. `pnpm check && pnpm check-types && pnpm test`.
