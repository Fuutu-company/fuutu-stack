---
name: write-tests-first
description: Use when implementing any feature, bug fix or behavior change — before writing the production code for it.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Write tests first

No production code without a test that failed first for the right reason.

## The loop

1. **Name the break.** Before writing the test, say which production change will make it pass (and therefore which current behavior makes it fail).
2. **Red.** Write one test for one behavior. Run it. It must fail — and the failure message must match the reason you named. A test that passes immediately or fails for another reason (import error, typo) proves nothing.
3. **Green.** Write the smallest code that makes it pass. No extras "while you're there".
4. **Whole suite.** Green means the package's full suite, not your file: `pnpm -F @fuutu/<pkg> test`. Report any other failure by name, even if you did not cause it.
5. **Refactor** with the suite green, then repeat.

Wrote code before the test? Delete it, write the test, watch it fail, rewrite the code. Keeping "reference code" defeats the point.

## What makes a test worth having

| Do | Avoid |
|---|---|
| Expected values written by hand as literals | Computing the expected value with the code under test |
| Assert behavior a user or caller depends on | Asserting constants, exact wording, private internals |
| Test your contract at the boundary (procedure input → output, HTTP status) | Re-testing the framework (Zod, Prisma, Hono) |
| One fake per branch: success, error, malformed — with the real data shape | One generic mock that always succeeds |
| Org-scoped data: a test where another org's id is rejected | Only testing the happy path |

## Where tests live in this kit

- Package logic: `packages/<pkg>/src/__tests__/*.test.ts` (Vitest) — run one file with `pnpm -F @fuutu/<pkg> test <path>`.
- Architecture rules: `packages/test-utils/src/arch/`.
- User flows: `apps/saas/tests/*.spec.ts`, `apps/marketing/tests/*.spec.ts` (Playwright).

## Before calling it done — mutation check

Mentally break the new code: flip a condition, return empty, drop a validation, skip the permission check. For each, name the test that would catch it. No test catches it → write one.

## Excuses that do not count

- "Too simple to test" — simple code breaks too; the test takes a minute.
- "I'll add tests after" — tests written after pass on the first run and prove nothing.
- "I tested it manually" — not repeatable, not in CI.
- "It's just a refactor" — then the existing tests must stay green; run them.
