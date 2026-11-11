---
name: verify-before-done
description: Use before saying work is done, fixed, passing or ready — and before committing, opening a pull request or handing work to the user.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Verify before calling it done

A claim without fresh evidence from this turn is a guess. Run the command, read the output, then report what it shows.

## The gate

1. Name the claim ("tests pass", "bug fixed", "types clean", "feature complete").
2. Pick the command that proves it (table below).
3. Run it now — not "it passed earlier".
4. Read the full output: exit code, failure count, warnings.
5. Report the result as it is, including failures.

| Claim | Proof |
|---|---|
| Lint/format clean | `pnpm check` → no errors |
| Types clean | `pnpm check-types` → all tasks successful |
| Tests pass | `pnpm test` (or `pnpm -F @fuutu/<pkg> test`) → 0 failed |
| Translations complete | `pnpm check-translations` → all keys present |
| User flow works | `pnpm test:e2e:saas` / `test:e2e:marketing` for the touched specs |
| UI works | `check-in-browser` — zero console errors |
| Bug fixed | regression test: fails with the fix reverted, passes with it |
| Requirements met | plan/spec re-read as a checklist, every line checked off |
| Subagent says "done" | read its actual diff and rerun its checks yourself |

## Words that mean you skipped the gate

"should work", "probably", "looks good", "I'm confident", "seems fixed", "Done!" before running anything. Replace them with the command and its result.

## Reporting

- All green: "`pnpm check-types`: 29/29 successful; `pnpm test`: 0 failed."
- Something red: say what failed, with the output, and what you will do next. Never round a failure up to success, and never claim a step you skipped.
