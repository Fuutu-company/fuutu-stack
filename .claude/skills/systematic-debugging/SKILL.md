---
name: systematic-debugging
description: Drives a four-phase root-cause investigation (investigate, compare patterns, test one hypothesis, fix with a failing test) instead of guess-and-check patching. Use when encountering any bug, test failure, build or type error, flaky test, or unexpected behavior, before proposing a fix.
license: MIT
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Systematic Debugging

Random fixes waste time and create new bugs. Quick patches mask the real issue.

**Core principle:** always find the root cause before attempting a fix. Symptom fixes are failures.

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose a fix. Use this **especially** under time pressure, when a "quick fix" seems obvious, or when a previous fix didn't work.

## Phase 1: Root Cause Investigation

1. **Read the error completely** — full stack trace, file paths, line numbers, error codes.
2. **Reproduce reliably** — a command or steps that trigger it every time. Not reproducible? Gather more data; don't guess.
3. **Check recent changes** — `git diff`, `git log`, new dependencies, env or config changes.
4. **Instrument component boundaries** — in multi-layer flows (UI → oRPC procedure → `@fuutu/db` query → provider), log what enters and exits each layer once to see WHERE it breaks. Use `createLogger` from `@fuutu/logs` for temporary instrumentation; remove it before committing.
5. **Trace the data backward** — where does the bad value originate? Who called this with it? Keep going up the call chain to the original trigger. Fix at the source, not where it surfaces.

If the `fuutu` MCP server is connected, call `docs_search` / `rules_get` for the domain involved (auth, payments, i18n, …) to check intended behavior; otherwise read the package source.

## Phase 2: Pattern Analysis

1. **Find working examples** — similar code in this repo that works.
2. **Read the reference completely** — don't skim.
3. **List every difference** — however small.
4. **Map dependencies** — config, env vars (`packages/env/src/`), providers, DB state, cookies, locale.

## Phase 3: Hypothesis and Testing

1. **One hypothesis** — "X is the root cause because Y."
2. **Test minimally** — smallest change, one variable at a time.
3. **Verify** — worked? Phase 4. Didn't? Form a NEW hypothesis. Don't stack fixes.
4. **Don't know?** Say "I don't understand X." Don't pretend.

## Phase 4: Implementation

1. **Failing test first** — simplest reproduction (`test-driven-development`).
2. **Single fix** — address the root cause. No "while I'm here" changes.
3. **Verify** — test passes, nothing else broke, original symptom gone (`verification-before-completion`).
4. **Fix didn't work?** Count attempts. Fewer than 3: back to Phase 1 with the new information.
5. **3+ failed fixes: question the architecture.** If each fix reveals a new problem somewhere else, the design is wrong. Stop and discuss with the user before trying more.

After the root-cause fix, consider defense in depth: validate at each layer the bad data passed through (Zod at the API boundary, invariants in the package, guards in the query function) so the bug class becomes impossible, not just this instance.

## Flaky Tests

- **Timing:** replace fixed sleeps with condition-based waits. In Playwright, use web-first assertions (`await expect(locator).toBeVisible()`) — never `waitForTimeout` or `waitForLoadState("networkidle")`. In Vitest, poll for the condition (`vi.waitFor`) or use fake timers.
- **Test pollution:** if a test fails only alongside others, bisect — run halves of the suite until you find the test that leaves the state behind (DB rows, env, module mocks, timers). Fix that test's cleanup.

## Red Flags — STOP, Return to Phase 1

- "Quick fix for now, investigate later"
- "Just try changing X and see"
- "Add several changes, then run the tests"
- "Skip the test, I'll verify manually"
- "It's probably X"
- "I don't fully understand, but this might work"
- Proposing fixes before tracing the data flow
- "One more attempt" after 2+ failures
- Each fix reveals a new problem in a different place

## Common Rationalizations

| Excuse | Reality |
|---|---|
| "The issue is simple" | Simple issues have root causes too. |
| "Emergency, no time" | Systematic is faster than guess-and-check. |
| "Try this first, then investigate" | The first fix sets the pattern. Do it right. |
| "I'll add the test after the fix works" | Untested fixes don't stick. |
| "Multiple fixes at once saves time" | You can't tell what worked, and you add bugs. |
| "I see the problem" | Seeing a symptom isn't understanding the cause. |

## Quick Reference

| Phase | Activities | Done when |
|---|---|---|
| 1. Root cause | Read, reproduce, trace back | You know WHAT and WHY |
| 2. Pattern | Compare with working code | Differences listed |
| 3. Hypothesis | One theory, minimal test | Confirmed, or new theory |
| 4. Fix | Failing test, single fix, verify | Bug gone, tests green |
