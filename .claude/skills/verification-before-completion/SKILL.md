---
name: verification-before-completion
description: Requires running the verification command that proves a claim and reading its fresh output before saying work is done, fixed, or passing. Use before any completion or success claim, before committing, and before opening a pull request — evidence before assertions, always.
license: MIT
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Verification Before Completion

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** evidence before claims. Violating the letter of this rule is violating its spirit.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the command in this turn, you cannot claim it passes.

## The Gate

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: which command proves this claim?
2. RUN: the full command, fresh
3. READ: full output, exit code, failure count
4. VERIFY: does the output confirm the claim?
   - No  → state the actual status, with evidence
   - Yes → state the claim, with evidence
5. ONLY THEN: make the claim
```

## Commands in This Repo

| Claim | Command |
|---|---|
| Lint/format clean | `pnpm check` |
| Types correct | `pnpm check-types` |
| Unit tests pass | `pnpm test` (or `pnpm -F @fuutu/<pkg> test`) |
| SaaS E2E pass | `pnpm test:e2e:saas` |
| Marketing E2E pass | `pnpm test:e2e:marketing` |
| Translations complete | `pnpm check-translations` |
| Build succeeds | `pnpm build` |

**Before every commit:** `pnpm check && pnpm check-types` green. `pnpm check` runs Biome with `--write` — re-read the diff afterwards; it may have changed files.

## UI and Route Changes — the Browser Gate

Commands don't catch console errors, hydration mismatches, blank renders, or broken redirects. Any change to pages, layouts, components, client hooks, providers, `next.config.ts`, or `proxy.ts` additionally requires `browser-verification` before "done".

| Claim | Required evidence |
|---|---|
| "The page renders" | Navigated to each affected route this session; content present |
| "No console errors" | Console read after navigation: 0 errors, 0 warnings |
| "The flow works" | Clicked/filled through the flow; console re-checked |

## Common Failures

| Claim | Requires | Not sufficient |
|---|---|---|
| Tests pass | Test output: 0 failures | A previous run, "should pass" |
| Lint clean | `pnpm check`: 0 errors | Partial check, extrapolation |
| Build succeeds | `pnpm build`: exit 0 | Lint and types passing |
| Bug fixed | Original symptom re-tested: gone | Code changed, assumed fixed |
| Requirements met | Line-by-line check against the spec/plan | Tests passing |
| Subagent finished | The diff shows the changes | The agent reported "success" |

## Red Flags — STOP

- "Should", "probably", "seems to"
- Satisfaction ("Done!", "Perfect!") before verification
- About to commit, push, or open a PR unverified
- Trusting a subagent's success report
- Partial verification, "just this once"

## Rationalizations

| Excuse | Reality |
|---|---|
| "Should work now" | Run the verification. |
| "I'm confident" | Confidence isn't evidence. |
| "Lint passed" | Lint isn't the type checker isn't the build. |
| "The agent said success" | Verify independently. |
| "Partial check is enough" | Partial proves nothing. |

## Bottom Line

Run the command. Read the output. Then claim the result. Non-negotiable.
