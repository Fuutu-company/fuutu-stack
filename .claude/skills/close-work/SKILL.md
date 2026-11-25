---
name: close-work
description: Use when the user accepts, merges or drops a piece of work, or when session start lists open work — to close everything it opened (agents, worktree, port slot, branch, plan files) and keep only the lasting decisions.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Close finished work

Open work lives on disk, not in the chat: a plan's progress file (`docs/plans/<plan>.progress.md`, header `Branch:` / `Worktree:` / `Slot:`) and its git worktree. Session start prints both (`[open-work] …`). Work is closed when the user accepts it — merged, or explicitly dropped.

## Steps

1. **Confirm** — the branch is merged (`git branch --merged <base>` lists it), or the user said to drop it. Unmerged work is deleted only on an explicit yes.
2. **Agents** — stop every background agent or task you started for it; none outlives its work.
3. **Worktree** (never the main checkout — its slot is permanent): in the worktree run `pnpm dev:session stop && pnpm ports release --drop-data`, then from the main checkout `git worktree remove <path>`.
4. **Branch** — `git branch -d <branch>` (refuses unmerged work); the remote branch only if the user agrees.
5. **Leftovers** — `pnpm ports prune`; `--yes` once the list is right.
6. **Files** — delete the progress file. Keep the plan or spec only if it records a decision the commit or PR does not.
7. **Memory** — keep what the environment cannot tell a future session: decisions (with the reason), verified rules, open follow-ups — one line each, with date and source (PR, commit). Drop transcripts, logs and anything code or git history shows. Remove entries this work made stale.

Report in one line per item: what was closed, what was kept and why.
