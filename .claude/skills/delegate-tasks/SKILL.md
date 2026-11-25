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

Do it yourself when the work is small: a question, a one-file fix, ≤ ~3 files with an obvious change, a config tweak. Delegation costs tokens and loses context; it pays off for separable work, parallel read-heavy searches and a fresh-eyes review — never "for a better answer".

## The team

`tier` in each agent's frontmatter is the vendor-neutral source of truth; other tools map it via [docs.fuutustack.com/docs/coding-agents/other-tools](https://docs.fuutustack.com/docs/coding-agents/other-tools).

| Agent | Use for | Tier → Claude model |
|---|---|---|
| `scout` | finding files, patterns, usages (read-only; several in parallel for independent questions) | fast → haiku |
| `architect` | approved design → plan; schema, auth, payments, cross-package decisions | strong → opus |
| `builder` | one low-risk task from the plan | balanced → sonnet |
| `senior-builder` | high-risk task (auth, payments, webhooks, RBAC, migrations, secrets, cross-package) or a task that failed twice | strong → opus |
| `reviewer` | after every builder task, and once over the whole diff (read-only) | balanced → sonnet |
| `qa` | gates, E2E, browser check | balanced → sonnet |
| `security` | diff touches auth, sessions, permissions, payments, webhooks, API keys, MCP, env, uploads, redirects (read-only) | strong → opus |
| `scribe` | docs, changelog, missing translations, commit message draft | fast → haiku |

The design conversation itself (`brainstorm-feature`) stays with you — you are the one talking to the user.

## The flow for a feature

1. **Understand** — `brainstorm-feature` with the user. Use `scout` for codebase questions instead of reading everything yourself.
2. **Plan** — small: write the plan yourself (`plan-implementation`). Larger or risky: `architect` writes it; you read it and resolve its `Needs decision` items with the user. Start the progress file (`execute-plan`) — it is your on-disk record of the open work.
3. **Build** — per task, in plan order: `builder` or `senior-builder` (by the task's `risk`) → `reviewer` on that task.
4. **Secure** — `security` if the diff touches its list.
5. **Prove** — `qa`.
6. **Wrap up** — final `reviewer` pass over the whole diff, `scribe` for docs/commit draft, then `propose-commit` with the user. On acceptance: `close-work`.

## Rules that keep the team reliable

- **One writer per task.** Only one agent edits files at a time. Read-only agents (`scout`, `reviewer`, `security`) may run in parallel.
- **Only you spawn agents.** Team agents never delegate further.
- **Compact, self-contained briefs** — the agent has no memory of this conversation. Give goal, task block or question, file paths (not pasted contents), spec/plan path, constraints, check command, report format; about 30 lines. Never "as discussed".
- **The reviewer gets fresh context**: the spec or task and the diff range — never the builder's report, notes or reasoning. It reports what breaks behaviour, security, the spec or a test; style and formatting are Biome's job.
- **Results come back condensed** in the agent's fixed format (≤ ~20 lines); long evidence goes to a file under `.fuutu/reports/` and the report gives the path.
- **One failure budget per task — two fix rounds**, whatever reports the failure (`reviewer` `CHANGES`, `qa` `FAIL`, red CI after a push). Round 1: findings back to the same tier. Round 2: `senior-builder`. Still failing → stop and rethink with the user, with the failing output. Reproduce a CI failure locally before fixing it.
- **Trust, but verify**: read the diff of every `DONE` and rerun its check before moving on (`verify-before-done`).
- **Model per role, fixed for the session**: start balanced; strong only for `risk: high` or after a failure; fast for anything that only reads or writes prose.

## Report to the user

Short status per phase: what was done, by which role, evidence (commands + results), open decisions. Never claim done before `qa` passed.
