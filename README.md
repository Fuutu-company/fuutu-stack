<p align="center">
  <img src="./assets/readme/hero.svg" alt="Fuutu Stack — enterprise-grade TypeScript SaaS starter kit with fair licensing" width="100%" />
</p>

<p align="center">
  <img src="./assets/readme/features.svg" alt="Fuutu Stack — enterprise features, autonomous AI workflow, agent harness, and tech stack" width="100%" />
</p>

---

## Quick Start

```bash
git clone https://github.com/Fuutu-company/fuutu-stack my-saas
cd my-saas
pnpm install
cp .env.example .env
pnpm db:start        # Postgres + MinIO via docker-compose
pnpm db:push         # push schema
pnpm db:seed         # optional: seed admin@fuutu.local / DevPassword!2345
pnpm dev             # saas :3000 · marketing :3001 · docs :4000
```

---

## What is Fuutu Stack?

A **production-grade TypeScript SaaS starter kit** — not a toy project. Next.js 16, Hono, oRPC, Better Auth, Prisma, TailwindCSS v4. Every domain (mail, payments, storage, analytics, AI) is behind a provider interface with one active implementation and skeletons for the rest. Swap Plunk for Resend, Polar for Stripe, S3 for Cloudflare R2 — without touching business logic.

**AI-native**: built-in MCP (Model Context Protocol) integration so LLM agents can discover and operate your project. AI provider-swappable (Google / OpenAI / Anthropic / Noop).

---

## Features

- **Next.js 16** (App Router, React 19, Turbopack) + **TypeScript** strict
- **Hono 4** + **oRPC 1.12** — end-to-end type-safe API with auto-OpenAPI
- **Better-Auth 1.6** — Email/Password, Magic-Link, OAuth, 2FA, Passkeys, Username, Organizations, Admin, Ban, Invitation-only
- **Prisma 7** on PostgreSQL 16 (split `auth` + `app` schemas, generated Zod)
- **TailwindCSS v4** (OKLCH theme) + **shadcn/ui** (framework-agnostic)
- **next-intl 4** — `en` + `de`, 100% translation policy
- **Provider-swappable** — Plunk (mail), Polar (payments), S3 + MinIO (storage), Umami (analytics)
- **AI provider-swappable** — Google / OpenAI / Anthropic / Noop
- **MCP-ready** — Model Context Protocol integration for LLM agents
- **Security** — rate-limit, CSP, HSTS, open-redirect guard, audit log
- **Turborepo** + pnpm workspaces (version-catalog)

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
│   ├── api/              # oRPC routers + Hono server
│   ├── auth/             # Better Auth (server + client)
│   ├── db/               # Prisma client + queries (ORM-agnostic export)
│   ├── ui/               # shared UI components (framework-agnostic)
│   ├── mail/             # MailProvider interface + templates
│   ├── payments/         # PaymentProvider interface + Polar
│   ├── storage/          # StorageProvider interface + S3/MinIO
│   ├── analytics/        # AnalyticsProvider interface + Umami
│   ├── ai/               # AI provider-swappable (Google/OpenAI/Anthropic)
│   ├── i18n/ env/ config/ logs/ utils/ rbac/ content/
│   └── license/ telemetry/   # Fuutu Business License compliance
├── tooling/
│   ├── typescript/       # shared tsconfigs
│   └── tailwind/         # shared Tailwind preset + theme.css
```

Detailed architecture: **[stack.fuutu.com/docs/architecture](https://stack.fuutu.com/docs/architecture)**

---

## MCP Integration

Fuutu publishes a separate MCP (Model Context Protocol) server that lets LLM agents — Claude Desktop, Cursor, Windsurf — discover Fuutu-Stack projects and call managed tools against them.

This repository contains the **integration point** for that server. No MCP runtime is bundled. To enable:

1. Copy `fuutu.config.example.ts` to `fuutu.config.ts` in the repo root
2. Fill in `projectId` (issued at [stack.fuutu.com](https://stack.fuutu.com))
3. Point your MCP-aware editor at the Fuutu MCP server

`fuutu.config.ts` is gitignored by default — keep it local unless you want every developer to share the same `projectId`.

---

## Developer Experience — Extension + MCP

### VS Code Extension

**"Fuutu Stack Companion"** — available in the VS Code Marketplace. Works in VS Code and Cursor.

- **Project Health** — port monitor, kill ports, service status at a glance
- **Commands Panel** — run any pnpm script with one click
- **Docs & Wiki** — architecture, rules, and guides in-sidebar
- **13 commands** — dev, build, check, check-types, db:studio, kill port, open config…
- **Infisical support** — prefix commands with `infisical run --` for secret injection

### Fuutu MCP

The AI agent harness — 28 skills, 5 subagents, 21 rules — is delivered via the **Fuutu MCP server**, not bundled in this repo. Point your MCP-aware editor (Cursor, Devin, Windsurf, VS Code) at the Fuutu MCP server and the full harness activates. The MCP exposes **tool calls** — deterministic functions the LLM can invoke (scaffold, swap provider, check compliance) instead of guessing code from context.

| Layer | Count | What it does |
|---|---|---|
| **Skills** | 28 | TDD, brainstorming, systematic-debugging, browser-verification, self-learning, commit-proposal, codebase-graph, review… — auto-invoked based on task context |
| **Subagents** | 5 | `harvest` (scan/grep/read) · `implementer` (code/TDD) · `verifier` (run/parse) · `synthesizer` (cross-ref) · `designer` (architecture) — cost-tiered, parallel dispatch |
| **Rules** | 21 | global, auth, backend, frontend, ui, testing, security, i18n, rbac, logging, license, review… — enforced, not suggestions |
| **Multi-host** | 4 editors | Cursor · Devin · Windsurf · VS Code |

Beyond the agent harness, the MCP server also provides:

- **Project Scaffolding** — "add a new package", "create a route with auth guard", "scaffold a new module" — generates code that follows Fuutu conventions by default
- **Provider Swaps** — "swap Plunk for Resend", "switch Polar to Stripe" — generates the active implementation from the provider interface
- **Versioning API** — Kit updates, breaking-change alerts, auto-migration suggestions when a new Fuutu Stack version drops
- **Compliance Check** — verifies all 5 fingerprint emission points, license validity, telemetry setup
- **Smart Debugging** — send errors to the MCP, it knows the Fuutu codebase structure and can pinpoint root causes

**Default workflow:** `brainstorm → plan → implement (TDD) → verify → browser-check → commit`. The orchestrator dispatches subagents in parallel, each with the cheapest capable cost tier.

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

**Free for teams up to 10 employees or $250k annual revenue.** Above that, you need an Enterprise License.

| Tier | Price | Who |
|---|---|---|
| **OSS** | Free | ≤ 10 employees AND ≤ $250k revenue |
| **MCP Subscription** | Monthly | Anyone who wants MCP + versioning API |
| **Enterprise** | Yearly | Above either OSS threshold |

Full terms: **[LICENSE.md](./LICENSE.md)** · Pricing: **[stack.fuutu.com/pricing](https://stack.fuutu.com/pricing)**

---

## Links

- **Documentation**: [stack.fuutu.com/docs](https://stack.fuutu.com/docs)
- **Pricing**: [stack.fuutu.com/pricing](https://stack.fuutu.com/pricing)
- **Support**: [devin.ai/support](https://devin.ai/support)
- **License**: [LICENSE.md](./LICENSE.md)
