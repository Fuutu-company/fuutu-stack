---
name: execute-plan
description: Use when a saved implementation plan exists and the user wants it carried out in this session.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Execute a plan

Work through a saved plan task by task without losing state, and finish with evidence.

## Before the first task

1. Read the plan and its `Spec:` completely. Raise contradictions or gaps **now**, not halfway through.
2. Decide where the work runs (AGENTS.md → "Branch or not") and say it in one line: a plan usually earns its own branch; a worktree only if other writers run in parallel.
3. Confirm the baseline is green: `pnpm check-types` and the tests of the packages you will touch. Report pre-existing failures by name before you start.
4. Create a progress file next to the plan: `docs/plans/<plan-name>.progress.md` — a header (`Branch:`, `Worktree:` or `none`, `Slot:` from `pnpm ports`), a checklist of task titles and a "Rulings" section. It survives context compaction and is the on-disk record of open work (session start lists it); re-read it after any interruption, delete it in `close-work`.

## Per task

1. Follow `write-tests-first` for the task's test.
2. Implement exactly what the task says.
3. Run the task's `Check:` command and read the output.
4. Tick the task in the progress file.

## Making decisions on the way

When the plan is silent or wrong, decide yourself if the choice is reversible and inside the repo. Log each ruling in the progress file: what you decided, why, and what it costs if wrong. The spec wins over the plan.

**Stop and ask** only for: destructive actions (dropping data, deleting files outside the task), security-sensitive changes (auth, permissions, secrets), anything outside the repo (accounts, deploys, payments, pushing), a new runtime dependency, or a plan that cannot work as written.

## Finish

1. Re-read the plan as a checklist; every task done or explicitly ruled out.
2. Full gates: `pnpm check && pnpm check-types && pnpm test` (+ E2E for touched flows).
3. UI touched → `check-in-browser`.
4. Review the complete diff once with fresh eyes (or have a subagent do it with `review-code`).
5. Report: what was built, rulings made, follow-up risks. Then `propose-commit`; once the user accepts the work, `close-work`.
