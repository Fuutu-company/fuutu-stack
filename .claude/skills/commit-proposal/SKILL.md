---
name: commit-proposal
description: Prepares a Conventional Commits message for finished, verified work, shows the files and message to the user, and asks once for approval. Commits locally only after an explicit yes; never pushes, merges, rebases, or opens pull requests on its own. Use at the end of any task that left uncommitted changes in the working tree.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Commit Proposal

The user is the commit authority. This skill prepares a clean commit and asks once.

```
NEVER COMMIT OR PUSH WITHOUT EXPLICIT USER APPROVAL
```

## When to Use

- The task is complete, verification is green (`verification-before-completion`, plus `browser-verification` for UI), and the working tree has changes.
- **Skip** if the tree is clean, the user said not to commit, or the task was read-only.
- **Red gates → no proposal.** Report what failed instead.

## Before Proposing

1. `git status` — what changed. Flag anything that must not be committed: `.env*`, secrets, keys, `node_modules/`, `.next/`, `dist/`, `.turbo/`, generated ORM output.
2. `git diff` — confirm every change belongs to this task.
3. `git log --oneline -10` — match the repo's established commit style.
4. `pnpm check && pnpm check-types` green — fresh output this turn.

## Message Format

```
<type>(<optional scope>): <imperative summary, ≤72 chars, no period>

<optional body — wrapped at 72, explains WHY, not WHAT>
```

| Type | When |
|---|---|
| `feat` | New user-visible capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no behavior change |
| `refactor` | Restructuring, no behavior change |
| `perf` | Performance improvement |
| `test` | Tests only |
| `build` | Build system, dependencies, workspace config |
| `ci` | CI configuration (`.github/workflows/`) |
| `chore` | Tooling, scripts, misc |
| `revert` | Reverting a prior commit |

- **Subject:** imperative ("add", "fix" — not "added"), English.
- **Scope:** lowercase package or area — `feat(auth)`, `fix(api)`, `chore(deps)`. Omit when cross-cutting.
- **One logical change per commit.** Two unrelated concerns → propose two commits. Don't split an atomic change just to use more types.
- Reference issue or PR numbers only if they actually exist. No invented IDs, no trailers the user didn't ask for.

## The Proposal

Append to the final report, in the user's language:

````
## Proposed commit

**Files:**
- path/to/file.ts — what changed
- …

**Message:**
```
<type>(<scope>): <summary>

<body>
```

Create this commit? (yes/no) — local commit only, no push.
````

- Ask **once**.
- **Yes** → stage exactly the listed files (`git add <paths>` — never `git add -A` or `git add .`), re-check `git status`, then commit (HEREDOC for multi-line messages).
- **No, later, or no answer** → don't commit. Leave the tree as is.
- A yes covers **this one commit only.** Push, merge, rebase, branch changes, and PRs each need their own explicit instruction.

## Rules

- **No `--no-verify`, no `--amend`, no `--force`.** If a hook rejects the commit, fix the root cause and commit again.
- **Sensitive file staged?** Abort and surface it.
- **Git not writable** (sandbox, permissions)? Say so once and give the user the exact `git add … && git commit …` command to run.

## Red Flags — STOP

- About to run `git commit` without a yes in this conversation
- About to `git push` because the commit succeeded
- Proposing a commit while a gate is red
- `git add -A` "because it's faster"
