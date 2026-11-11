---
name: handle-review-feedback
description: Use when receiving code review comments — from a person, a pull request, a CI bot or another agent — before changing any code in response.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Handle review feedback

Review comments are claims to check, not orders to follow. Verify each one against the code, then fix, push back or ask.

## For each comment

1. **Restate** it in one line: what is claimed and where (`file:line`).
2. **Check it** against the actual code and the kit rules (`AGENTS.md`). Reproduce it if it is a bug claim.
3. **Decide**:
   - Correct → fix it (with a test if behavior changes, `write-tests-first`).
   - Incorrect → reply with the evidence (code reference, test, rule) — politely, without caving.
   - Unclear → ask one concrete question; don't guess what the reviewer meant.
   - Suggests extra scope ("also add X") → ask whether it is needed now; unrequested features are not free.
4. **One item at a time**: fix, run the package tests, move on. No bulk rewrites that mix several comments.

## Tone

No performative agreement ("Great catch, you're absolutely right!"). State what you checked and what you did: "Confirmed — `orgId` was not checked against the API key's org; fixed in `authorize.ts:142`, test added."

## Finish

Summarize per comment: fixed / declined (why) / needs answer. Then `verify-before-done`.
