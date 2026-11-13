---
name: delegate-tasks
description: Use when you are the main session and a request needs more than a small edit — a feature, a multi-file change, an investigation across packages, a release check — to decide what you do yourself and what you hand to the team agents in .claude/agents/.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Lead the team

You are the **lead** — the only one who talks to the user, decides, and owns the result. You plan, route, verify. The team (`.claude/agents/`) does focused work on cheaper models with fresh context.

## When NOT to delegate

Do it yourself when the work is small: a question, a one-file fix, ≤ ~3 files with an obvious change, a config tweak. Delegation costs tokens and loses context; it pays off only for separable work.

## Routing

| Need | Agent | Tier |
|---|---|---|
| Find files, patterns, usages | `scout` (several in parallel for independent questions) | fast |
| Approved design → plan; schema/auth/payments/cross-package decision | `architect` | strong |
| One low-risk task from the plan | `builder` | balanced |
| High-risk task (auth, payments, webhooks, RBAC, migrations, secrets, cross-package) or a task that failed twice | `senior-builder` | strong |
| After every builder task, and once over the whole diff | `reviewer` | balanced |
| Gates, E2E, browser check | `qa` | balanced |
| Diff touches auth, sessions, permissions, payments, webhooks, API keys, MCP, env, uploads, redirects | `security` | strong |
| Docs, changelog, missing translations, commit message draft | `scribe` | fast |

The design conversation itself (`brainstorm-feature`) stays with you — you are the one talking to the user.

## The flow for a feature

1. **Understand** — `brainstorm-feature` with the user. Use `scout` for codebase questions instead of reading everything yourself.
2. **Plan** — small: write the plan yourself (`plan-implementation`). Larger or risky: `architect` writes it; you read it and resolve its `Needs decision` items with the user.
3. **Build** — per task, in plan order: `builder` or `senior-builder` (by the task's `risk`) → `reviewer` on that task. `CHANGES` → send the findings back to the same tier once; second failure → `senior-builder`; third → stop and rethink with the user.
4. **Secure** — `security` if the diff touches its list.
5. **Prove** — `qa`. `FAIL` → route the failure to a builder, then `qa` again.
6. **Wrap up** — final `reviewer` pass over the whole diff, `scribe` for docs/commit draft, then you run `propose-commit` with the user.

## Rules that keep the team reliable

- **One writer at a time.** Only one builder edits code at once. Read-only agents (`scout`, `reviewer`, `security`) may run in parallel.
- **Only you spawn agents.** Team agents never delegate further.
- **Every brief is self-contained** — the agent has no memory of this conversation. Include: goal, task block or question, file paths, spec/plan path, constraints, the check command, the expected report format. Never "as discussed".
- **Handoffs are files**: spec in `docs/specs/`, plan + progress in `docs/plans/`. Reports come back in the agent's fixed format.
- **Trust, but verify**: read the diff of every `DONE` and rerun its check before moving on (`verify-before-done`).
- **Escalate by evidence, not by default.** Start balanced; move to strong for `risk: high` or after a failure. Use the fast tier for anything that only reads or writes prose.

## Report to the user

Short status per phase: what was done, by which role, evidence (commands + results), open decisions. Never claim done before `qa` passed.
