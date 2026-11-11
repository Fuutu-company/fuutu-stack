---
name: plan-implementation
description: Use when an approved design or a clear multi-step requirement exists and the work spans more than one file or step — before touching code.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Plan the implementation

Turn an approved design into an ordered task list that a capable engineer can execute without re-deciding anything.

## A plan records decisions, not code

Each step states **what** and **how it is checked**: file paths, function signatures, test names with their assertions, exact values from the design, exact commands. Write a function body only when the signature and tests leave real ambiguity.

**Proportion check:** if the plan grows several times longer than the design, it has turned into a transcript of the code — cut it back to decisions.

## Header (required)

```md
# <Feature> — implementation plan
Spec: docs/specs/<file>.md   (or "chat, <date>")
Goal: <one sentence>
Packages touched: <list>
```

The `Spec:` line is mandatory — when the plan and the spec disagree during execution, the spec wins.

## Tasks

Each task = one action with a checkable result. Order them so the repo stays green after every task.

```md
### Task 3 — <name>
Files: packages/api/src/modules/invoices/procedures/create.ts, …
Test first: `packages/api/src/__tests__/invoices.test.ts` → "rejects members without invoice:create" (expects FORBIDDEN)
Change: <signature / behavior / values>
Check: `pnpm -F @fuutu/api test invoices` → passes; `pnpm check-types` → 0 errors
```

Kit checklist — include the tasks that apply:
- DB: model in `packages/db/prisma/schema/`, migration, query functions in `packages/db/prisma/queries/`
- API: Zod input, `authProcedure` permission, rate limit on mutations, router registration
- UI: module in `apps/saas/src/modules/`, no literal strings
- i18n: keys in **every** locale under `packages/i18n/translations/<locale>/`
- Env: Zod schema in `packages/env/src/` + `.env.example`
- Tests: unit (Vitest) for logic, IDOR case for org data, E2E for user flows

## Review focus (required)

Up to five inputs or failure modes the design implies but no planned test covers yet (empty state, other org's id, expired session, concurrent update, missing env). Give each one a test inside the task that owns that code.

## Save and hand off

Save to `docs/plans/YYYY-MM-DD-<topic>.md` (local working doc). Ask the user to review the saved plan, then recommend how to run it:
- **execute-plan** inline — for short plans or tightly coupled steps
- delegate tasks to subagents — for many independent tasks (each task gets a self-contained brief: files, test, check)
