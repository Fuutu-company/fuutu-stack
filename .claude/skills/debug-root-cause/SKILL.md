---
name: debug-root-cause
description: Use when something is broken — a bug report, failing or flaky test, build or type error, unexpected behavior, or a fix that did not work — before proposing any change.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Debug to the root cause

No fix until you can state the cause and point to the evidence. Guess-and-patch creates new bugs and hides the real one.

## 1. Investigate

- Read the full error and stack trace. Note file, line, and the first frame in our code.
- Reproduce it reliably; write down the exact steps or command.
- Check what changed recently: `git log -p -- <path>`, `git diff`.
- Trace the bad value backwards through the call chain to where it first goes wrong — fix there, not where it surfaces.
- Monorepo boundaries: find which package owns the failing behavior; check its public exports and config (`packages/<domain>/src/config.ts`).
- If the `fuutu` MCP server is connected, call `docs_search` / `rules_get` for the domain to confirm intended behavior.
- Need more data? Add temporary instrumentation with `createLogger` from `@fuutu/logs` (in tests, write to stderr). Log whether secrets are set, never their values. Remove it before committing.

## 2. Compare

Find a working example of the same pattern in the repo. List every difference between working and broken, however small.

## 3. One hypothesis at a time

State it: "X fails because Y". Make the smallest change that tests only that. Confirmed → step 4. Refuted → back to step 1 with what you learned. Never stack fixes.

## 4. Fix with a test

1. Write a failing test that reproduces the bug (`write-tests-first`).
2. Fix the cause.
3. Prove the test guards it: revert the fix → test fails; restore → test passes.
4. Run the package suite.

## Stop signals

- Three fixes failed → the design is likely wrong. Stop and discuss the architecture with the user.
- The user says "stop guessing", "is that even happening?" or similar → you skipped investigation; return to step 1.
- Truly external or timing cause (third-party outage, race you cannot control): document what you checked, add handling, logging and a test for the handling. Assume first that the investigation is incomplete.

## Flaky tests

Replace sleeps with waiting for the condition (`expect.poll`, Playwright auto-wait). To find a test that leaks state into others, bisect: run halves of the suite until the polluter is isolated.
