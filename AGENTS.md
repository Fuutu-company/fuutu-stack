# AGENTS.md

Operating manual for AI coding agents (Claude Code, Cursor, Codex, Copilot, Windsurf, …) in this repository.

## Your project

> Fill this in — it is yours and survives kit updates (it lives outside the kit block below).

```
Product        : <what you are building>
Users          : <who uses it>
Key decisions  : <providers, deviations from kit defaults>
Constraints    : <deadlines, compliance, performance budgets>
```

<!-- BEGIN:fuutu-kit -->
<!-- Kit-owned block: replaced when you merge a Fuutu Stack update. Put your own rules outside it. -->

## 1 · What this repo is

Your app, built on **Fuutu Stack** — a TypeScript SaaS starter kit (pnpm + Turborepo monorepo). `apps/saas` and `apps/marketing` ship as a working demo of the kit's features; replace the demo content with your product. Before launch, set `config.features.designSystem: false` — otherwise the `/design` style guide ships to your users.

| | Your app | The kit (Fuutu-owned) |
|---|---|---|
| Name | `config.app.name` (`packages/config/index.ts`) | `KIT_NAME` |
| Version | root `package.json#version` → `APP_VERSION` (`@fuutu/config/app-version`, server-only), tags `vX.Y.Z` | `KIT_VERSION`, tags `kit-vX.Y.Z` |

`KIT_NAME`, `KIT_VERSION`, the fingerprint (§8) and telemetry are **read-only** — they change only when a kit update is merged. Never bump `KIT_VERSION` for an app release.

## 2 · Fuutu MCP (optional, recommended)

If the `fuutu` MCP server is connected (see `.mcp.json`), use it before guessing:
- free, no key: `docs_search` / `docs_get` — kit docs matched to this repo's `KIT_VERSION`; `changelog_get`, `version_check`
- Fuutu Pro (key in `FUUTU_MCP_API_KEY`): `rules_get` — detailed rules per domain (auth, payments, i18n, …); `skills_get` — full instructions for skills marked `fuutu-source: mcp`

Without it, everything still works: read the owning package's source and follow this file.

## 3 · Stack

Node ≥ 20 · pnpm · Turborepo · TypeScript strict, ESM · Next.js 16 (App Router, React 19) · Hono at `/api/[[...rest]]` · oRPC (+ OpenAPI at `/api/docs`) · PostgreSQL + Prisma (`packages/db`) · Better Auth · Tailwind v4 (OKLCH; brand tokens in `packages/config/brand.css`, kit rules in `theme.css`, design contract in `DESIGN.md`) · `@fuutu/ui` (shadcn) · next-intl (`@fuutu/i18n`) · Zod · TanStack Query · Biome · Vitest · Playwright · MCP server (`@fuutu/mcp`, `/api/mcp`).

**Swappable domains** — one active provider behind a typed interface, selected in the package config; callers import only `@fuutu/<domain>`: `mail`, `payments`, `storage`, `analytics`, `logs`, `ai`. `db` swaps by reimplementing its query functions.

## 4 · Workspace

```
apps/saas        :3000* authed app + API (Hono/oRPC, MCP at /api/mcp)
apps/marketing   :3001* public site, locale-prefixed URLs
apps/docs        :4000* docs site for YOUR product (Fumadocs)
apps/mail-preview:4003* mail template preview (dev only)
packages/*              domain logic — config, env, db, auth, api, ui, i18n, mail, payments,
                        credits, storage, analytics, rbac, logs, notifications, cron, search,
                        utils, content, license, telemetry, webhooks, mcp, ai, test-utils
```

\* Slot 0. Every project and git worktree gets its own **port slot** (ports, local DB, buckets, login cookie, session browser) — `pnpm ports` shows it; a team pins one with `pnpm ports pin`. Never hard-code a port: apps start through `tooling/scripts/next.mjs`. A worktree's slot is temporary — `close-work` releases it.

## 5 · Commands

```bash
pnpm dev | dev:saas | dev:marketing | dev:docs
pnpm check            # Biome format + lint (--write)
pnpm check-types      # tsc across workspaces
pnpm test             # Vitest
pnpm test:e2e:saas | test:e2e:marketing | test:e2e:docs
pnpm db:start | db:migrate | db:push | db:seed | db:studio
```

`pnpm check && pnpm check-types && pnpm test` must be green before every commit.

**Live session:** `pnpm dev:session` keeps DB, apps and one visible browser running (Claude Code starts it at session start; opt out: `FUUTU_DEV_SESSION=0`). Agents use their own role-prefixed tabs and never stop it — `check-in-browser`.

## 6 · Code patterns

Most rules below are machine-checked — Biome, `pnpm test` (arch guards in `packages/test-utils/src/arch/`, API router policy), `pnpm check-translations`, `.claude/hooks/` — and the failing check names the fix.

- **TypeScript**: strict, no `any`, no `console.*` — `createLogger({ scope })` from `@fuutu/logs`.
- **Env**: only via `@fuutu/env/saas` | `/marketing` | `/docs`, never `process.env`. New vars: Zod schema + `.env.example`.
- **DB**: only the query functions exported by `@fuutu/db` — never the raw client outside `packages/db`.
- **Generated files** (migrations, Prisma client + Zod, lockfile, shadcn components, `next-env.d.ts`, `.source/`): only via their command, never by hand — the hook names the command. Schema changes: edit `packages/db/prisma/schema/`, then `pnpm --filter @fuutu/db db:migrate --name <change>`; shadcn: `pnpm dlx shadcn@4.21.4 add`. A migration needing custom SQL → stop and ask.
- **API**: oRPC procedure with Zod input; `authProcedure({ systemPermission | org: { permission } })` / `systemAdminProcedure(permission)` from `packages/api/src/orpc/procedures.ts` for protected data; rate limit on every mutation; `denyImpersonation` on payments, API-key, webhook and org mutations; register in `packages/api/src/orpc/router.ts` — `add-api-endpoint`.
- **MCP tools**: `defineMcpTool` (`@fuutu/mcp`) with `access: "public" | "authenticated" | (principal) => boolean`; register in `packages/api/src/mcp/index.ts`.
- **Auth guards**: server-side in layouts (`requireAuth()` / `requireOnboarded()` from `apps/saas/src/lib/auth-server.ts`); `proxy.ts` is an optimistic pre-check only.
- **Redirects**: `getSafeRedirect()` from `@fuutu/utils/redirect`.
- **i18n**: zero literal strings in JSX; keys in every locale under `packages/i18n/translations/<locale>/` in the same change; ICU for plurals/params; `pnpm check-translations`.
- **UI**: `@fuutu/ui` imports no `next/*`; one `cn` from `@fuutu/utils/cn`; semantic color tokens only (`DESIGN.md`) — edit `brand.css`, never `theme.css`; `build-ui`.
- **Routes** (saas): flat (`/dashboard`, `/settings`) — `(app)` is a route group.
- **Naming**: camelCase vars/functions · PascalCase types · UPPER_SNAKE constants · kebab-case files.

## 7 · Architecture & security (non-negotiable)

- Package-first: domain logic in `packages/*`; apps are glue + UI.
- Config lives with its owner (`authConfig`, `i18nConfig`, `paymentsConfig`, `apiConfig`); `@fuutu/config` is cross-cutting only.
- Plans only in `PLANS` / `FEATURE_CATALOG` / `LIMITS` (`@fuutu/payments/config`); apps call `buildPricingTiers()`.
- `apps/marketing` never imports auth, DB, `@fuutu/api` or `@fuutu/env/saas`.
- All input validated with Zod. Errors generic to users, detailed in logs. Secrets in `httpOnly` cookies only. Rate-limit auth + mutations.
- **Stay mergeable with kit updates** (`git merge` from the kit): customise through the app-owned files — `app-*.ts(x)`, `server-init.ts`, `custom-routes.ts`, `proxy-public.ts`, `mcp/server.ts`, `api-key-scopes.ts` ([Extend without forking](https://docs.fuutustack.com/docs/concepts/extend-without-forking)) — and the config objects above. Edit a kit-owned file only when no extension point fits, and then minimally: keep its identifiers, file names, env vars, i18n keys and formatting; append instead of interleaving; never rename, reorder or reword for taste. Replace a whole kit component with a new file plus a one-line import swap, not by rewriting it.

## 8 · Kit-owned — do not modify

License-relevant (`LICENSE.md` §6(5), §7): `KIT_NAME` / `KIT_VERSION` / `KIT_FINGERPRINT_*` / `KIT_GENERATOR_META` in `packages/config/index.ts`, the `X-Framework` header emitters (`packages/api/src/app.ts`, `apps/*/next.config.ts`, `apps/*/src/proxy.ts`), `metadata.generator` in `apps/*/src/app/layout.tsx`, and `packages/telemetry` (`FUUTU_TELEMETRY_DISABLED=1` only for local development and non-production instances — a Production Application keeps telemetry on, `LICENSE.md` §7).

## 9 · Testing

Vitest in `packages/*/src/__tests__/`; Playwright in `apps/{saas,marketing}/tests/`; architecture guards in `packages/test-utils/src/arch/`. Every bug fix gets a regression test; never delete or weaken tests. After UI changes, check affected routes in a real browser — zero console errors.

## 10 · Workflow & skills

Skills live in `.claude/skills/` (mirrored at `.agents/skills/`), listed in `fuutu.skills.json`. Use the matching skill before acting:

| Situation | Skill |
|---|---|
| Request bigger than a small edit (main session) | `delegate-tasks` |
| New feature / behavior change | `brainstorm-feature` → `plan-implementation` → `execute-plan` |
| Implementing code or a fix | `write-tests-first` |
| Bug, failing test, odd behavior | `debug-root-cause` |
| About to claim done | `verify-before-done` (+ `check-in-browser` for UI) |
| Review comments received | `handle-review-feedback` |
| Work verified, changes exist | `propose-commit` — conventional messages drive the app version; never commit/push without approval |
| Work accepted, merged or dropped; session start lists open work | `close-work` |
| Building or changing UI: pages, components, styles, a single-token tweak | `build-ui` (+ `check-in-browser`) |
| Rebrand: colors, fonts, radius, density | `setup-brand` (full version via Fuutu MCP) |
| New entity / API endpoint / provider swap / payments / code review | `add-entity` · `add-api-endpoint` · `swap-provider` · `connect-payments` · `review-code` (full versions via Fuutu MCP) |

### Team and lifecycle

The main session is the **lead**: it talks to the user, plans, routes and verifies; small work (≤ ~3 files, obvious change) it does itself. Team agents live in `.claude/agents/` — routing, tiers and models in `delegate-tasks`. One writer per task; only the lead spawns agents.

Open work is on disk — plan progress files in `docs/plans/` and worktrees, listed at session start; close it on acceptance with `close-work`.

**Memory** (notes, memory files, the "Your project" block): keep only decisions with their reason, verified rules and open items, each with date and source. Never transcripts, logs or anything the code or git history shows. Prune what a closed piece of work made stale.

## 11 · Boundaries

- **Ask first**: new runtime dependencies · DB schema changes beyond the task · `turbo.json`, `pnpm-workspace.yaml`, root scripts, `next.config.ts`, `biome.json` · breaking package exports.
- **Never**: commit secrets or `.env` · hand-edit generated files (§6; also `node_modules`, `.next`, `dist`, `.turbo`) · force-push `main` (Claude Code: `.claude/hooks/protect-main.mjs`) · touch §8.

Behave like a senior engineer: smallest correct change, verify APIs in code before using them, state open questions and follow-up risks explicitly.

<!-- END:fuutu-kit -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
