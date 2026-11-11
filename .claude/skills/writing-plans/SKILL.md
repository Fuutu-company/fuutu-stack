---
name: writing-plans
description: Converts an approved spec or clear multi-step requirements into a bite-sized, test-first implementation plan with exact file paths, code, commands, and expected output. Use after brainstorming produces an approved spec, or whenever a multi-step task needs a plan, before touching code.
license: MIT
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Writing Plans

Write the plan assuming the implementer has zero context for this codebase. Document every file to touch, the code, the tests, and how to verify. Bite-sized tasks. DRY. YAGNI. TDD.

**Save to:** `docs/plans/YYYY-MM-DD-<topic>.md` (`/docs/` is gitignored — plans are local working docs, not committed).

## Before Writing

- **Scope check** — if the spec covers independent subsystems, write one plan per subsystem. Each plan must produce working, testable software on its own.
- **Verify against real code** — confirm every path, export, and signature you reference exists. Never guess APIs.
- If the `fuutu` MCP server is connected, call `docs_search` / `rules_get` for the domains involved; otherwise read the package source.
- **Map the files** — list what gets created or modified before defining tasks. Follow `AGENTS.md` (package-first, provider pattern, config ownership).

## Task Right-Sizing

A task is the smallest unit with its own test cycle and an independently testable deliverable. Each step is one action (2-5 minutes): write failing test → run it, see it fail → minimal implementation → run, see it pass → lint + types.

## Plan Header

```markdown
# [Feature Name] Implementation Plan

**Goal:** [one sentence]
**Architecture:** [2-3 sentences]
**Spec:** docs/specs/YYYY-MM-DD-<topic>-design.md

## Global Constraints

[Project-wide requirements copied verbatim from the spec — limits, naming, copy rules, dependency rules. Every task implicitly includes this section.]

---
```

## Task Template

````markdown
### Task N: [Component]

**Files:**
- Create: `packages/<pkg>/src/<file>.ts`
- Modify: `packages/<pkg>/src/<existing>.ts:123-145`
- Test: `packages/<pkg>/src/__tests__/<file>.test.ts`

**Interfaces:**
- Consumes: [exact signatures from earlier tasks]
- Produces: [exact names, params, return types later tasks rely on]

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { functionName } from "../file";

describe("functionName", () => {
	it("does X when Y", () => {
		expect(functionName(input)).toBe(expected);
	});
});
```

- [ ] **Step 2: Run it — expect FAIL**
Run: `pnpm -F @fuutu/<pkg> test src/__tests__/<file>.test.ts`
Expected: FAIL — "functionName is not a function"

- [ ] **Step 3: Minimal implementation**

```ts
export function functionName(input: InputType): OutputType {
	return expected;
}
```

- [ ] **Step 4: Run it — expect PASS**
Run: `pnpm -F @fuutu/<pkg> test src/__tests__/<file>.test.ts`

- [ ] **Step 5: Lint + types**
Run: `pnpm check && pnpm check-types` — expected: 0 errors
````

## No Placeholders

These are plan failures:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" without the test code
- "Similar to Task N" — repeat the code
- Steps that say what without showing how
- References to types or functions no task defines

## Repo Specifics to Bake Into Tasks

- **Tests** — Vitest per package (`pnpm -F @fuutu/<pkg> test`, all: `pnpm test`); Playwright E2E in `apps/{saas,marketing}/tests/` (`pnpm test:e2e:saas`, `pnpm test:e2e:marketing`).
- **Gates** — `pnpm check && pnpm check-types` green at the end of every task.
- **i18n** — user-visible strings get keys in `packages/i18n/translations/<locale>/` for every shipped locale, in the same task. No literals in JSX.
- **Validation** — every user input has a Zod schema; put it in the plan.
- **Env** — `@fuutu/env/saas` or `@fuutu/env/marketing`, never `process.env`.
- **DB** — typed query functions exported from `@fuutu/db`; schema changes get their own task with `pnpm db:generate` / `pnpm db:migrate`.
- **UI** — tasks touching routes or components end with a `browser-verification` step.

## Self-Review

1. **Spec coverage** — every spec requirement maps to a task.
2. **Placeholder scan** — no red flags from the list above.
3. **Type consistency** — names and signatures match across tasks.

Fix inline. Then tell the user where the plan is and ask whether to execute it task by task now.
