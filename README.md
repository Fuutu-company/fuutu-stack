<p align="center">
  <img src="./assets/readme/hero.svg" alt="Fuutu Stack — enterprise-grade TypeScript SaaS starter kit with fair licensing" width="100%" />
</p>

<p align="center">
  <img src="./assets/readme/features.svg" alt="Fuutu Stack — enterprise features, AI-ready agent setup, and tech stack" width="100%" />
</p>

<p align="center">
  <a href="https://discord.gg/fF7fgQ7jZ3">💬 Discord</a> · <a href="https://fuutustack.com">📄 Docs</a> · <a href="https://github.com/Fuutu-company/fuutu-stack/issues">🐛 Issues</a> · <a href="./LICENSE.md">⚖ License</a>
</p>

---

## Quick Start

```bash
git clone https://github.com/Fuutu-company/fuutu-stack my-saas
cd my-saas
pnpm install
cp .env.example .env
pnpm db:start        # Postgres 16 + MinIO via docker-compose (local dev only)
pnpm db:migrate      # apply migrations — includes raw-SQL constraints (db:push skips those)
pnpm db:seed         # optional: seed admin@fuutu.local / DevPassword!2345
pnpm dev             # saas :3000 · marketing :3001 · docs :4000
```

---

## What is Fuutu Stack?

A **production-grade TypeScript SaaS starter kit** — not a toy project. Next.js 16, Hono, oRPC, Better Auth, Prisma, TailwindCSS v4. Every domain (mail, payments, storage, analytics, AI, search) is behind a provider interface with one active implementation and skeletons (stubs that throw until implemented) for the rest. Swap Plunk for Resend, Creem for Stripe, S3 for Cloudflare R2 — without touching business logic.

**AI-ready**: ships an `AGENTS.md`, Claude Code config and workflow skills so coding agents work with the kit's conventions from the first prompt, plus an MCP server foundation for your own app. AI provider-swappable (OpenRouter / Google / OpenAI / Anthropic / Noop).

---

## Features

### Authentication & Security
- **Email/Password** with password policy + validation
- **Magic-Link** sign-in
- **OAuth** social login
- **2FA** (TOTP) + **Passkeys** (WebAuthn)
- **Organizations** — multi-tenant, members, invitations, seat syncing
- **RBAC** — granular role-based access control
- **Admin panel** — user management, ban, admin override
- **Invitation-only signup** — gate registration by domain or allowlist
- **Rate limiting** — per-endpoint, configurable
- **CSP** + **HSTS** + **open-redirect guard**
- **Audit logs** — immutable, paginated, org-scoped, auto-retention

### API & Backend
- **Hono 4** server (mounted at `/api/[[...rest]]`)
- **oRPC 1.15** — end-to-end type-safe API with auto-OpenAPI spec
- **Zod** validation on every input
- **API keys** — generate, revoke, scoped access
- **Webhooks** — signed delivery, retry with backoff, at-least-once with `X-Fuutu-Event-Id` dedupe key for receivers
- **Cron jobs** — audit-log cleanup, subscription reminders, telemetry ping, webhook retry

### Database & ORM
- **Prisma 7** on PostgreSQL 16
- Split `auth` + `app` schemas
- Generated Zod schemas from Prisma types
- ORM-swappable queries — all callers go through typed `@fuutu/db` functions; swapping ORMs touches one package

### Frontend & UI
- **Next.js 16** (App Router, React 19, Turbopack)
- **TailwindCSS v4** with OKLCH theme
- **shadcn/ui** — framework-agnostic shared components (`@fuutu/ui`)
- **next-intl 4** — `en` + `de`, 100% translation policy ([guide](https://docs.fuutustack.com/docs/i18n))
- **MediaFrame** — locale-aware images, CSP-safe

### Provider-Swappable Architecture
Every domain behind an interface — swap providers without touching business logic:

| Domain | Interface | Active | Skeletons |
|---|---|---|---|
| **Mail** | `EmailProvider` | Plunk (Resend implemented) | Postmark, Mailgun, Nodemailer… |
| **Payments** | `PaymentProvider` | Creem (Stripe implemented; Polar alpha) | Anything else via `customProvider`… |
| **Storage** | `StorageProvider` | S3 + MinIO | Supabase, Noop… |
| **Analytics** | `AnalyticsProvider` | Umami (GDPR consent built-in) | Plausible, Pirsch, Mixpanel, GA4… |
| **AI** | `AIProvider` | OpenRouter (Google implemented) | OpenAI, Anthropic, Noop… |
| **Search** | `SearchProvider` | Postgres | MeiliSearch, Typesense (`noop` returns empty — dev/test)… |

### AI-Native
- **AI provider-swappable** — OpenRouter / Google / OpenAI / Anthropic / Noop
- **Chat module** — conversations, messages, streaming
- **MCP server foundation** — `/api/mcp` with public/authenticated tools, API-key auth, rate limiting (`@fuutu/mcp`)
- **AI agent setup** — `AGENTS.md`, Claude Code config, workflow skills (see AI-ready below)

### App Modules (SaaS)
- **Dashboard** — overview, activity feed
- **Chat** — AI conversations with streaming
- **CRM** — contacts, pipeline
- **Notifications** — in-app, multi-channel
- **Organizations** — team management, invitations
- **Onboarding** — guided setup flow
- **Settings** — profile, API keys, billing
- **Admin** — audit logs, user management
- **Billing** — plans, subscriptions, invoices, credit metering + top-up packages

### Infrastructure
- **Turborepo** + pnpm workspaces (version-catalog)
- **Biome** — format + lint (replaces ESLint + Prettier)
- **Vitest** — 1,900+ unit + integration tests
- **Playwright** — E2E tests (saas + marketing)
- **Telemetry** — build-time + runtime, non-blocking
- **License compliance** — 5 fingerprint emission points, kit integrity
- **Logging** — `createLogger({ scope })` with provider interface

---

## Architecture

```
fuutu-stack/
├── apps/
│   ├── saas/             # authed app + API (port 3000)
│   ├── marketing/        # public site (port 3001)
│   ├── docs/             # documentation (port 4000)
│   └── mail-preview/     # mail template preview (dev only)
├── packages/
│   ├── ai/               # AI provider-swappable (OpenRouter/Google/OpenAI/Anthropic/Noop)
│   ├── analytics/        # AnalyticsProvider interface + Umami
│   ├── api/              # oRPC routers + Hono server
│   ├── auth/             # Better Auth (server + client)
│   ├── config/           # cross-cutting config + theme.css
│   ├── content/          # TSX content collections: posts, changelog, legal
│   ├── credits/          # credit meters + grant/consume/reset over @fuutu/db
│   ├── cron/             # scheduled jobs (audit cleanup, reminders, telemetry)
│   ├── db/               # Prisma client + queries (ORM-swappable export)
│   ├── env/              # environment validation (@t3-oss/env-nextjs)
│   ├── i18n/             # next-intl utilities + i18nConfig
│   ├── license/          # checkLicense(), getLicenseMode() — compliance
│   ├── logs/             # createLogger({ scope }) + provider interface
│   ├── mail/             # EmailProvider interface + templates
│   ├── notifications/    # in-app + multi-channel notifications
│   ├── payments/         # PaymentProvider interface + Creem/Stripe/Polar (alpha)
│   ├── rbac/             # role-based access control
│   ├── search/           # SearchProvider interface
│   ├── storage/          # StorageProvider interface + S3/MinIO
│   ├── telemetry/        # build-time + runtime telemetry helpers
│   ├── test-utils/       # shared test helpers + architecture guard tests
│   ├── ui/               # shared UI components (framework-agnostic)
│   ├── utils/            # cn, getSafeRedirect, slugify, hash, invariant, getBaseUrl, rate-limit
│   └── webhooks/         # signed delivery, retry, idempotent
├── tooling/
│   ├── typescript/       # shared tsconfigs (base / nextjs / react-library)
│   └── scripts/          # repo tooling (assets-sync.mjs, dependency-report.mjs)
```

Detailed architecture: **[docs.fuutustack.com/docs/concepts/architecture](https://docs.fuutustack.com/docs/concepts/architecture)**

---

## Name & version — kit vs. your app

Two independent identities. Never mix them up.

| | **Your app** | **The kit** (Fuutu's) |
|---|---|---|
| What | The product you build on the kit | The Fuutu Stack release you are based on |
| Name | `config.app.name` in `packages/config/index.ts` — titles, manifest, auth/onboarding copy, 2FA issuer, passkey RP name, API title | `KIT_NAME` (`Fuutu-Stack`) |
| Version source | root `package.json` → `"version"` (starts at `0.0.0`) | `KIT_VERSION` in `packages/config/index.ts` |
| Runtime | `APP_VERSION` from `@fuutu/config/app-version` · `/api/version` → `app.version` · OpenAPI `info.version` | `KIT_VERSION` · `/api/version` → `version` · `X-Framework` header · `<meta name="generator">` |
| Who changes it | You — `pnpm version patch\|minor\|major` or `.github/workflows/version.yml` | Only Fuutu. It changes when you **merge a kit update** — never edit it by hand |
| Git tags | `vX.Y.Z` | `kit-vX.Y.Z` |

Why `KIT_NAME` / `KIT_VERSION` are read-only: the Fuutu MCP serves docs, rules and skills matched to it, support identifies your base release by it, and it is part of the kit fingerprint (LICENSE.md §6(5), §7). A wrong value means wrong AI guidance and unactionable bug reports.

Automated app releases: `.github/workflows/version.yml` computes the next semver from your conventional commits (`feat` → minor, `fix`/`perf` → patch, `!`/`BREAKING CHANGE` → major) via the Fuutu versioning API and tags `vX.Y.Z`. Merge strategy doesn't matter (merge, squash, rebase) — only commit messages count. Commits that arrive with a kit update are excluded, so kit changes never bump your app version.

---

## Deployment

Docker (per-app `Dockerfile`s + `docker-compose.deploy.yml`) and Coolify (Dockerfile or Railpack). See the **[deployment docs](https://docs.fuutustack.com/docs/deployment)**.

---

## AI-ready

### In the repo — free, works without any subscription

| What | Where |
|---|---|
| Agent instructions (read by Claude Code, Cursor, Codex, Copilot, Windsurf, …) | `AGENTS.md` (+ `CLAUDE.md` → `@AGENTS.md`) |
| 10 workflow skills — `delegate-tasks` (lead), `brainstorm-feature`, `plan-implementation`, `execute-plan`, `write-tests-first`, `debug-root-cause`, `verify-before-done`, `check-in-browser`, `propose-commit` (versioning-aware), `handle-review-feedback` | `.claude/skills/` (mirrored at `.agents/skills/`) |
| 5 kit skills — `add-entity`, `add-api-endpoint`, `swap-provider`, `connect-payments`, `review-code` — minimal path in the repo, full version-matched version via Fuutu MCP | `.claude/skills/` |
| Skill catalog | `fuutu.skills.json` |
| Claude Code project config (Fuutu MCP server, permissions, hook that blocks hand edits of generated files) | `.mcp.json`, `.claude/settings.json`, `.claude/hooks/` |
| Team of 8 agents (scout, architect, builder, senior-builder, reviewer, qa, security, scribe) on cost tiers; the main session leads via `delegate-tasks` | `.claude/agents/` |
| MCP servers: Fuutu, Better Auth, Next.js DevTools, shadcn, Playwright | `.mcp.json` |
| Setup guide for any other agent (Cursor, Copilot, Codex, OpenCode, …) + upgrade migration | [docs: Set up any AI agent](https://docs.fuutustack.com/docs/coding-agents/other-tools) |

### MCP server for your own app

`@fuutu/mcp` (official MCP TypeScript SDK v2) is mounted at `/api/mcp`. Define tools with `defineMcpTool` and mark each `public`, `authenticated` or a custom rule (role, scope, org). Callers authenticate with an organization API key carrying the `mcp` scope; anonymous callers only see public tools. Two example tools ship: `app_info` (public) and `whoami` (authenticated). Configure it under `apiConfig.mcp` (`packages/api/src/config.ts`).

### Fuutu MCP — free + MCP Plus

Connects your coding agent to Fuutu's MCP server (already configured in `.mcp.json`).

- **Free, no key** (rate-limited per IP): docs search, docs pages, changelog and update check — **matched to your `KIT_VERSION`**.
- **MCP Plus** (set `FUUTU_MCP_API_KEY`, per-user limits): per-domain rules, the full kit skills, and the versioning API used by `.github/workflows/version.yml`. Included in Enterprise.

Without the server, everything in the repo keeps working.

---

## Scripts

```bash
pnpm dev                   # all apps in parallel
pnpm dev:saas              # saas only
pnpm dev:marketing         # marketing only
pnpm build                 # build everything
pnpm check                 # biome format + lint --write
pnpm check-types           # tsc --noEmit across workspaces
pnpm db:push / :migrate / :studio / :seed / :start / :stop
pnpm test                  # vitest (unit/integration)
pnpm test:e2e              # Playwright (saas + marketing)
```

---

## License

**Free for teams with ≤ 10 employees and ≤ $250k annual revenue.** Once you exceed either threshold, you need an Enterprise License.

| Tier | Price | Who |
|---|---|---|
| **OSS** | Free | ≤ 10 employees AND ≤ $250k revenue |
| **MCP Plus** | Monthly | Anyone who wants MCP rules, full skills + versioning API |
| **Enterprise** | Yearly | Above either OSS threshold |

Full terms: **[LICENSE.md](./LICENSE.md)** · Pricing: **[fuutustack.com/pricing](https://fuutustack.com/pricing)**

---

## Links

- **Documentation**: [docs.fuutustack.com](https://docs.fuutustack.com/docs)
- **Pricing**: [fuutustack.com/pricing](https://fuutustack.com/pricing)
- **Support**: [fuutustack.com](https://fuutustack.com)
- **License**: [LICENSE.md](./LICENSE.md)

---

## Top Sponsors

<!-- Top-5 sponsor slots — the 5 largest sponsors by tier/size.
     Replace each placeholder with the sponsor logo + name.
     Updated manually on sponsorship changes. -->
<p align="center">
  <a href="https://fuutustack.com/sponsors">Sponsor&nbsp;1</a> ·
  <a href="https://fuutustack.com/sponsors">Sponsor&nbsp;2</a> ·
  <a href="https://fuutustack.com/sponsors">Sponsor&nbsp;3</a> ·
  <a href="https://fuutustack.com/sponsors">Sponsor&nbsp;4</a> ·
  <a href="https://fuutustack.com/sponsors">Sponsor&nbsp;5</a>
</p>

<p align="center">
  <a href="https://fuutustack.com/sponsors">See all supporters →</a>
</p>
