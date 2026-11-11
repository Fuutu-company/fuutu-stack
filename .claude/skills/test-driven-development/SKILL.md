---
name: test-driven-development
description: Enforces red-green-refactor — write one failing test, watch it fail for the right reason, write the minimal code to pass, then refactor. Use when implementing any feature, bug fix, or behavior change, before writing implementation code.
license: MIT
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail. Write minimal code to pass.

**Core principle:** if you didn't watch the test fail, you don't know if it tests the right thing. Violating the letter of this rule is violating its spirit.

## The Iron Law

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

Wrote code before the test? Delete it and start over. Don't keep it as "reference", don't "adapt" it, don't look at it. Delete means delete.

## Red-Green-Refactor

### RED — write one failing test

One behavior, a clear name, real code (mocks only when unavoidable).

```ts
import { describe, expect, it } from "vitest";
import { retryOperation } from "../retry";

describe("retryOperation", () => {
	it("retries a failing operation until it succeeds", async () => {
		let attempts = 0;
		const operation = async () => {
			attempts++;
			if (attempts < 3) throw new Error("fail");
			return "success";
		};

		await expect(retryOperation(operation)).resolves.toBe("success");
		expect(attempts).toBe(3);
	});
});
```

### Verify RED — mandatory

```bash
pnpm -F @fuutu/<pkg> test src/__tests__/<file>.test.ts
```

Confirm it **fails** (not errors), with the expected message, because the feature is missing (not a typo).
- **Passes immediately?** You're testing existing behavior. Fix the test.
- **Errors?** Fix the error, re-run until it fails correctly.

### GREEN — minimal code

Simplest code that passes. No extra features, no refactoring elsewhere, no "improvements".

### Verify GREEN — mandatory

Re-run the test. It passes, the rest of the package's tests still pass, output is clean.
- **Test fails?** Fix the code, not the test.
- **Other tests fail?** Fix them now.

### REFACTOR — after green only

Remove duplication, improve names, extract helpers. Tests stay green. No new behavior.

## Commands in This Repo

| Scope | Command |
|---|---|
| One package / one file | `pnpm -F @fuutu/<pkg> test [path]` |
| All unit tests | `pnpm test` |
| E2E | `pnpm test:e2e:saas` / `pnpm test:e2e:marketing` |
| Gates | `pnpm check && pnpm check-types` |

Unit tests live in `packages/<pkg>/src/__tests__/`; E2E specs in `apps/{saas,marketing}/tests/`. For UI flows, the failing test can be a Playwright spec.

## Testing Anti-Patterns

| Anti-pattern | Gate question | Fix |
|---|---|---|
| Asserting on mock behavior | "Am I testing real behavior or that the mock exists?" | Delete the assertion or unmock |
| Test-only methods in production code | "Is this only used by tests?" | Move it to test utilities |
| Mocking without understanding | "What side effects does the real thing have? Does my test need them?" | Run with the real implementation first, then mock minimally |
| Incomplete mocks | "Does this mock match the real data shape?" | Mock the complete structure as it exists in reality |
| Mock setup longer than the test | "Would an integration test be simpler?" | Use real code, or test at a different boundary |

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "Too simple to test" | Simple code breaks. The test takes 30 seconds. |
| "I'll test after" | Tests that pass immediately prove nothing. |
| "Already manually tested" | Ad-hoc isn't systematic. No record, can't re-run. |
| "Deleting hours of work is wasteful" | Sunk cost. Unverified code is debt. |
| "Keep it as reference, write tests first" | You'll adapt it. That's testing after. |
| "Need to explore first" | Fine. Throw the exploration away, then TDD. |
| "TDD slows me down" | TDD is faster than debugging. |

## Red Flags — STOP and Start Over

- Code before test, or test after implementation
- Test passes on first run
- You can't explain why the test failed
- "Just this once", "I already tested it manually", "keep as reference"

**All of these mean: delete the code, start over with TDD.**

## Bugs

Found a bug? Write a failing test that reproduces it, then follow the cycle. The test proves the fix and prevents regression. Never fix a bug without a test.

## Final Rule

```
Production code → a test exists and failed first
Otherwise → not TDD
```

No exceptions without the user's explicit permission.
