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

Your app, built on **Fuutu Stack** (TypeScript SaaS kit, pnpm + Turborepo). `apps/saas` and `apps/marketing` are the kit's demo — replace it with your product, and set `config.features.designSystem: false` before launch.

| | Your app | The kit (read-only) |
|---|---|---|
| Name | `config.app.name` (`packages/config/index.ts`) | `KIT_NAME` |
| Version | root `package.json#version` → `APP_VERSION` (server-only), tags `vX.Y.Z` | `KIT_VERSION`, tags `kit-vX.Y.Z` |

`KIT_NAME`, `KIT_VERSION`, the fingerprint (§8) and telemetry change only by merging a kit update. Never bump `KIT_VERSION` for an app release.

## 2 · Fuutu MCP

If the `fuutu` MCP server is connected (`.mcp.json`), ask it before guessing: `docs_search` / `docs_get` (free, matched to `KIT_VERSION`); with a Fuutu Pro key in `FUUTU_MCP_API_KEY`, `rules_get` (rules per domain) and `skills_get` (full skills). Without it, read the owning package's source.

## 3 · Stack

Next.js 16 · Hono + oRPC (`/api`, OpenAPI at `/api/docs`) · Prisma + PostgreSQL · Better Auth · Tailwind v4 + `@fuutu/ui` · next-intl · Zod · Biome · Vitest · Playwright. `mail`, `payments`, `storage`, `analytics`, `logs` and `ai` each have one provider behind `@fuutu/<domain>` — `swap-provider`.

## 4 · Workspace

`apps/saas` (app, API, MCP) · `apps/marketing` · `apps/docs` (your product's docs) · `apps/mail-preview` · domain logic in `packages/*`. Each checkout and worktree has its own port slot — `pnpm ports` shows its URLs; never hard-code a port.

## 5 · Commands

Scripts are in `package.json`. `pnpm check && pnpm check-types && pnpm test` is green before every commit. The live dev session and its browser: `check-in-browser`.

## 6 · Code patterns

Machine-checked by Biome, `pnpm test` (`packages/test-utils/src/arch/`, API router policy), `pnpm check-translations` and `.claude/hooks/`; the failing check names the fix.

- TypeScript strict, no `any`, no `console.*` (`createLogger` from `@fuutu/logs`); env only via `@fuutu/env/<app>`, never `process.env`.
- DB only through the `@fuutu/db` query functions.
- Generated files: never create, edit or delete them by hand (reading is fine). Migrations: edit `packages/db/prisma/schema/`, then `pnpm --filter @fuutu/db db:migrate --name <change>` (custom SQL → stop and ask) · Prisma client + Zod → `pnpm db:generate` · lockfile → `pnpm add/remove` · shadcn → `pnpm dlx shadcn@4.21.4 add` · `next-env.d.ts`, `.source/` → `pnpm check-types`.
- API: Zod input, `authProcedure` / `systemAdminProcedure`, rate limit on every mutation, `denyImpersonation` on payments, API-key, webhook and org mutations; MCP tools via `defineMcpTool` with an explicit `access` — `add-api-endpoint`. Desktop access tokens reach only procedures marked `desktopAllowed` (`.use(desktopAllowed)` or `authProcedure({ desktopAllowed: true })`); the token stays pinned to its org and plan-gated by `apiConfig.apiKeyScopeFeatures.desktop`.
- Auth guards server-side in layouts (`requireAuth()` / `requireOnboarded()`), `proxy.ts` is a pre-check only; redirects via `getSafeRedirect()`.
- No literal strings in JSX; keys in every locale under `packages/i18n/translations/<locale>/` in the same change, ICU for plurals and params.
- Semantic color tokens only; edit `brand.css`, never `theme.css` — `build-ui`.
- camelCase · PascalCase types · UPPER_SNAKE constants · kebab-case files.

## 7 · Architecture & security (non-negotiable)

- Domain logic in `packages/*`, apps are glue + UI. Config lives with its owner (`authConfig`, `i18nConfig`, `paymentsConfig`, `apiConfig`); `@fuutu/config` is cross-cutting only.
- Plans only in `PLANS` / `FEATURE_CATALOG` / `LIMITS` (`@fuutu/payments/config`); apps call `buildPricingTiers()`.
- `apps/marketing` never imports auth, DB, `@fuutu/api` or `@fuutu/env/saas`.
- Zod on all input. Errors generic to users, detailed in logs. Secrets only in `httpOnly` cookies. Rate-limit auth + mutations.
- **Stay mergeable with kit updates**: customise through the app-owned files (`app-*.ts(x)`, `server-init.ts`, `custom-routes.ts`, `proxy-public.ts`, `mcp/server.ts`, `api-key-scopes.ts`, desktop `app-nav.ts` / `app-home.tsx` / `app-about.tsx` / `app-shell-slot.tsx` / `app-capabilities.ts` / `app-tauri-config.ts` / `app-sidecars.mjs` / `app-ci.mjs` / `src-tauri/app-ext/` / `app_plugins.rs` / `app_build.rs` / `deny.app.toml` — `apps/desktop/RELEASING.md`) and the config objects above — [Extend without forking](https://docs.fuutustack.com/docs/concepts/extend-without-forking). Edit a kit-owned file only when no extension point fits, and then minimally: keep identifiers, file names, env vars, i18n keys and formatting; append, never rename, reorder or reword. Replace a whole kit component with a new file plus a one-line import swap.

## 8 · Kit-owned — do not modify

License-relevant (`LICENSE.md` §6(5), §7): `KIT_NAME` / `KIT_VERSION` / `KIT_FINGERPRINT_*` / `KIT_GENERATOR_META` in `packages/config/index.ts`, the `X-Framework` header emitters (`packages/api/src/app.ts`, `apps/*/next.config.ts`, `apps/*/src/proxy.ts`), `metadata.generator` in `apps/*/src/app/layout.tsx`, and `packages/telemetry` (`FUUTU_TELEMETRY_DISABLED=1` only for local development and non-production instances — a Production Application keeps telemetry on, `LICENSE.md` §7).

## 9 · Testing

Every bug fix gets a regression test; never delete or weaken tests. After UI changes, check the affected routes in a real browser with zero console errors — `check-in-browser`.

## 10 · Workflow & skills

Use the matching skill (`.claude/skills/`, mirrored at `.agents/skills/`, listed in `fuutu.skills.json`) before acting:

| Situation | Skill |
|---|---|
| More than a small edit (main session) | `delegate-tasks` |
| New feature / behaviour change | `brainstorm-feature` → `plan-implementation` → `execute-plan` |
| Writing code or a fix | `write-tests-first` |
| Bug, failing test, odd behaviour | `debug-root-cause` |
| About to claim done | `verify-before-done` |
| Review comments | `handle-review-feedback` |
| Commit or PR — never without approval | `propose-commit` |
| Work accepted, merged or dropped | `close-work` |
| Any UI change | `build-ui` + `check-in-browser` |
| Desktop app changed (`apps/desktop`, `config.features.desktop` on) | `check-in-desktop` |
| Rebrand | `setup-brand` |
| Entity · endpoint · provider · payments · review | `add-entity` · `add-api-endpoint` · `swap-provider` · `connect-payments` · `review-code` |

The main session is the **lead**: it talks to the user, does small work itself and routes the rest to `.claude/agents/` (`delegate-tasks`; other tools: [tier mapping](https://docs.fuutustack.com/docs/coding-agents/other-tools)). One writer per task; only the lead spawns agents. Open work (progress files in `docs/plans/`, worktrees) is listed at session start.

**Branch or not** — judge size and risk before the first edit and say the choice in one line ("small change, doing it directly on `develop`" / "own branch because …"). Small, low-risk changes (docs, notes, typos, config text, a one-file fix) go into the current checkout on the current branch: no worktree, no feature branch, no PR. A branch only for multi-file features, risky areas (auth, payments, migrations, secrets), work that must pass a PR (protected branch) or when the user asks; a worktree only when parallel agents or sessions would otherwise collide.

**Memory**: keep only decisions with their reason, verified rules and open items, each with date and source — never transcripts, logs or what code and git show. Prune what closed work made stale.

## 11 · Boundaries

- **Ask first**: new runtime dependencies · DB schema changes beyond the task · `turbo.json`, `pnpm-workspace.yaml`, root scripts, `next.config.ts`, `biome.json` · breaking package exports.
- **Never**: commit secrets or `.env` · hand-edit generated files (§6; also `node_modules`, `.next`, `dist`, `.turbo`) · force-push `main` · touch §8.

Smallest correct change; verify APIs in code before using them; state open questions and follow-up risks.

<!-- END:fuutu-kit -->

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
