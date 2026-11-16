# Contributing to Fuutu Stack

Thanks for your interest! Fuutu Stack is source-available under the [Fuutu Business License](./LICENSE.md), and community contributions are welcome. Community: sign in at https://app.fuutustack.com (Support).

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

Sign off every commit with `git commit -s` (adds a `Signed-off-by:` line matching the commit author). The `DCO` check fails pull requests with unsigned commits; to fix, run `git rebase --signoff <base>` and force-push your branch. See [Contribution terms](#contribution-terms). The check runs on pull requests from forks, which is how external contributions arrive. Branches in this repository belong to the maintainers, whose work is owned by Fuutu, so their pull requests skip it.

Every bug fix needs a regression test, and tests are never deleted or weakened to get green.

## Reporting issues

Use the Bug Report or Feature Request issue template. **Security vulnerabilities: do not open a public issue**, see [SECURITY.md](./SECURITY.md).

## Contribution terms

By submitting a contribution (for example a pull request), you agree to these terms, which are also section 11 of the [Fuutu Business License](./LICENSE.md):

1. You license your contribution to everyone, free of charge, under the [MIT No Attribution License (MIT-0)](https://spdx.org/licenses/MIT-0.html), and grant Fuutu and every recipient of the kit a royalty-free patent license as set out in section 11 of the License.
2. You sign off every commit (`git commit -s`), certifying the [Developer Certificate of Origin 1.1](https://developercertificate.org). You confirm that you have the right to submit the contribution, including your employer's consent where needed.
3. Fuutu may distribute your contribution as part of the kit under the Fuutu Business License or other terms. Your authorship stays visible in the git history.
4. Fuutu need not accept or use a contribution. Contributions are voluntary and unpaid and create no employment or other relationship.

If your pull request is merged, we can thank you on our contributors page, but only if you tick the box in the pull request template. See our [Privacy Policy](https://fuutustack.com/legal/privacy).
