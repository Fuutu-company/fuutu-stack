---
name: propose-commit
description: Use when verified work leaves uncommitted changes, or the user asks to commit, finish a branch or prepare a pull request.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Propose a commit

Prepare a commit whose message drives the app's automatic versioning correctly, show it, and commit only after an explicit yes. Never push, merge, rebase or open a pull request on your own.

## Why the message format matters here

`.github/workflows/version.yml` computes the next **app** version (root `package.json#version`, tags `vX.Y.Z`) from commit messages on `main`:

| Message | Version bump |
|---|---|
| `feat: …` / `feat(scope): …` | minor |
| `fix: …`, `perf: …` | patch |
| `type!: …` or a footer line `BREAKING CHANGE: …` | major (minor while below 1.0.0) |
| `docs`, `chore`, `style`, `refactor`, `test`, `ci`, `build`, `revert` | none |
| anything else | none (ignored) |

The highest bump among all commits since the last release wins, applied once. Merge strategy does not matter — merge commits, squash and rebase all work; only the messages count. Commits that came in with a kit update are excluded, and `KIT_VERSION` is never touched by app commits.

## Steps

1. **Evidence first** — `verify-before-done` passed this turn (`pnpm check && pnpm check-types && pnpm test`).
2. **Inspect** — `git status`, `git diff`, `git log --oneline -10`. Flag anything that must not be committed: `.env*`, keys, `node_modules/`, `.next/`, `dist/`, `.turbo/`, Prisma output, unrelated changes.
3. **Choose the type by user impact**, not by effort: new user-visible capability → `feat`; corrected behavior → `fix`; removed or incompatible API, route, env var, schema or config → add `!` and a `BREAKING CHANGE:` footer explaining the migration.
4. **One logical change per commit.** Mixed work → propose several commits, each with its own file list.
5. **Show the proposal**:

```
Files:
  packages/api/src/modules/invoices/procedures/create.ts
  packages/api/src/__tests__/invoices.test.ts
Message:
  feat(invoices): let org admins create draft invoices

  Adds invoices.create with invoice:create permission and rate limit.
Version effect: minor (0.3.2 → 0.4.0 on next release)
Commit? (yes / no / edit)
```

6. **Yes** → stage exactly those paths (`git add <paths>`, never `-A` or `.`), commit, show `git log -1 --stat`. A yes covers this one commit only.
7. **No / edit** → adjust and ask again.

## Finishing a branch

When the user wants to wrap up a branch: confirm the base branch (don't assume `main`), run the full gates on the final tree, then offer the options — merge locally, push and open a PR (they run it or explicitly ask you to), or keep the branch. Never use `--force`; if a push is rejected because the remote moved, stop and report.

## Never

- commit without a yes in this conversation, or push because the commit succeeded
- invent a `feat` for a refactor (it fakes a minor release) or hide a breaking change in a `fix`
- bump `KIT_VERSION`, edit `package.json#version` by hand in a feature commit, or create tags — releases are the workflow's job
