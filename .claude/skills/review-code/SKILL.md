---
name: review-code
description: Use when the user asks for a code review, before merging a branch, or after a larger change to check it against the kit's architecture, security and i18n rules.
metadata:
  fuutu-source: mcp
  fuutu-category: workflow
---

# Review code

The full, version-matched review checklist is served by the **Fuutu MCP** server (MCP Plus).

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "review-code" }` and follow the returned instructions. Without an MCP Plus key it returns an upgrade notice — then continue with step 2.
2. Otherwise review the diff (`git diff <base>...HEAD`) against `AGENTS.md` — package boundaries, env access, auth guards, org scoping (IDOR), rate limits, translations, tests — and report findings as critical / important / minor with `file:line`. Prefer a fresh agent context for the review.
