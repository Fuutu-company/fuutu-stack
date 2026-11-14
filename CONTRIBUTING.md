# Contributing to Fuutu Stack

Thanks for your interest! Fuutu Stack is source-available under the [Fuutu Business License](./LICENSE.md), and community contributions are welcome. Stuck? Open a support ticket in `#help` on [Discord](https://discord.gg/fF7fgQ7jZ3).

**Full contributing guide** (branching, hotfix flow, commit types, PR process, provider swaps): [docs.fuutustack.com/docs/support/contributing](https://docs.fuutustack.com/docs/support/contributing)

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

## Branching

Git Flow Lite: `feature/xxx` → PR → `develop` → release → `main` (tagged). Hotfixes branch from `main` and must be back-merged `main → develop` the same day.

| Action | Merge type |
|---|---|
| Feature → `develop` | **Squash** |
| `develop` → `main` | **Merge commit** |
| Hotfix → `main` | **Squash**, then tag the patch release |
| `main` → `develop` (after hotfix) | **Merge commit** |

Branch names: `feature/…`, `fix/…`, `docs/…`, `chore/…`, `hotfix/…` (targets `main`).

## Commits

The PR title *is* the squash commit message and must be a valid [Conventional Commit](https://www.conventionalcommits.org/): `feat:` (minor), `fix:` / `perf:` (patch), `!` or `breaking:` (major); `docs:`, `chore:`, `ci:`, `test:`, `refactor:`, `style:` do not bump the version.

## Pull requests

1. Branch from `develop` (`main` for hotfixes) and follow the conventions in [AGENTS.md](./AGENTS.md).
2. Run `pnpm check:ci`, `pnpm check-types` and `pnpm test`.
3. Open a PR against `develop` and fill in the template checklist.
4. CI must pass (`verify`, `build`, `e2e`). CI ships disabled: to enable it in your fork, see [Run tests in CI](https://docs.fuutustack.com/docs/testing/ci).
5. Address review feedback; the PR is squash-merged.

Every bug fix needs a regression test, and tests are never deleted or weakened to get green.

## Reporting issues

Use the Bug Report or Feature Request issue template. **Security vulnerabilities: do not open a public issue**, see [SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions are licensed under the [Fuutu Business License](./LICENSE.md).
