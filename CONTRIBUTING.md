# Contributing to Fuutu Stack

Thanks for your interest in contributing! Fuutu Stack is a commercial open-source project under the [Fuutu Business License](./LICENSE.md). Community contributions are welcome and appreciated.

> **Need help?** Join our [Discord](https://discord.gg/fF7fgQ7jZ3) — open a support ticket in `#help` and we'll get you unblocked.

## Quick Start

```bash
git clone https://github.com/Fuutu-company/fuutu-stack.git
cd fuutu-stack
pnpm install
cp .env.example .env
pnpm db:start        # Postgres + MinIO via docker-compose
pnpm db:migrate      # apply migrations (db:push skips raw-SQL constraints)
pnpm db:seed         # optional: seed admin@fuutu.local / DevPassword!2345
pnpm dev             # saas :3000 · marketing :3001 · docs :4000
```

## Development Workflow

### Branching

We use a **Git Flow Lite** workflow:

```
feature/xxx ──PR──▶ develop ──release──▶ main ──tag
                         ▲                   │
                         │  hotfix back-merge │
                         └────────────────────┘
```

| Action | Merge type | Why |
|---|---|---|
| Feature → `develop` | **Squash** | One clean commit per PR, conventional commit message |
| `develop` → `main` | **Merge commit** | Release boundary, history stays consistent |
| Hotfix → `main` | **Squash** | One commit, then `main → develop` back-merge |
| `main` → `develop` (after hotfix) | **Merge commit** | Brings hotfix back cleanly |

**Squash-merge rule:** the PR title *is* the squash commit message. It must be a valid Conventional Commit — that single line is what drives the semver bump at release time, so get the type right before merging.

**Hotfix flow:** branch `hotfix/<x>` from `main` → PR → squash-merge → tag the **patch** release immediately → back-merge `main → develop` the same day. Skipping the back-merge lets the fix drift out of `develop` and resurface as a regression in the next release.

### Branch Naming

- `feature/<short-description>` — new features
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation only
- `chore/<short-description>` — tooling, deps, refactoring
- `hotfix/<short-description>` — urgent production fixes (targets `main`)

### Commit Messages (Conventional Commits)

PR titles must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add subscription cancellation flow
fix: correct seat count on organization update
docs: update authentication guide
chore: bump prisma to 7.0.1
breaking: rename EmailProvider.send() to EmailProvider.sendMail()
```

| Prefix | Bump | Example |
|---|---|---|
| `feat:` | minor | `feat: add API key revocation` |
| `fix:` / `perf:` | patch | `fix: prevent duplicate webhook delivery` |
| `breaking:` or any `!` suffix | major | `feat!: drop node 18 support` |
| `docs:` / `chore:` / `ci:` / `test:` / `refactor:` / `style:` | none | `docs: add deployment guide` |

Squash-merge uses the PR title as the commit message — keep it a valid Conventional Commit.

Releases are **manual**:

1. Move the `CHANGELOG.md` `Unreleased` entries into a dated section.
2. Bump `KIT_VERSION` in `packages/config/index.ts` **and** `packages/telemetry/bin/ping.mjs`.
3. Sync the app `package.json` versions.
4. Tag `vX.Y.Z` and create the GitHub Release.

### Pull Request Process

1. Create a feature branch from `develop` (or `main` for hotfixes)
2. Make your changes — follow the code conventions below
3. Run `pnpm check` (lint + types + tests)
4. Open a PR targeting `develop` (or `main` for hotfixes)
5. Fill in the PR template checklist
6. CI must pass: `verify` (lint, types, translations, unit/integration tests), `build`, `e2e (saas)` / `e2e (marketing)`
7. Address review feedback
8. Squash-merge when approved

### Code Conventions

- **TypeScript strict** — no `any`, no `// @ts-ignore`
- **Biome** for formatting + linting (replaces ESLint + Prettier)
- **Zod** for all input validation
- **`@fuutu/logs`** for logging — never `console.log` in production code
- **i18n** — every user-visible string through `useTranslations()` / `getTranslations()`
- **Provider interfaces** — never import a concrete provider directly; use the interface
- **Tests** — Vitest for unit/integration, Playwright for E2E
- **No hardcoded config** — use `@fuutu/<domain>/config` or `@fuutu/config`

### Testing

```bash
pnpm test              # all unit + integration tests
pnpm test:e2e          # Playwright E2E (saas + marketing)
pnpm check-types       # TypeScript type checking (all workspaces)
pnpm check             # lint + types + tests (full pipeline)
```

### Provider Swaps

If you add a new provider implementation (e.g. Resend for mail):

1. Create `packages/<domain>/src/providers/<name>.ts`
2. Implement the provider interface
3. Add a skeleton entry in `packages/<domain>/src/providers/skeletons.ts`
4. Add tests in `packages/<domain>/src/__tests__/`
5. Document in the provider's README

## Enabling CI

CI ships **disabled**. Until you opt in, every job is skipped — skipped runs explain themselves via the run name and a summary page with these same steps.

**Step 1 — set the repository variable:**

1. Open your repo on GitHub → **Settings** (top bar)
2. Left sidebar → **Secrets and variables** → **Actions** → tab **Variables**
3. **New repository variable** → Name `FUUTU_CI_ENABLED`, Value `true` → **Add variable**

**Step 2 — optional, hosted visual reports** (requires step 1):

1. Same place: create a second variable `FUUTU_PAGES_ENABLED` = `true`
2. **Settings** → left sidebar **Pages** (under *Code and automation*)
3. Under **Build and deployment → Source** select **Deploy from a branch**
4. Under **Branch** select `gh-pages` and folder `/(root)` → **Save**

CI then publishes the per-PR visual-diff report to `https://<owner>.github.io/<repo>/pr-<N>/<app>/` and links it in the visual-changes PR comment. Without `FUUTU_PAGES_ENABLED`, reports still ship as workflow artifacts.

> The `gh-pages` branch is created automatically on the first deploy — if it doesn't appear in the Branch dropdown yet, open a PR that produces a visual report first, then finish step 2.

## Reporting Issues

- **Bugs**: Use the Bug Report issue template
- **Feature requests**: Use the Feature Request issue template
- **Security vulnerabilities**: See [SECURITY.md](./SECURITY.md) — **do not open a public issue**

## License

By contributing, you agree that your contributions will be licensed under the [Fuutu Business License](./LICENSE.md).
