---
name: fuutu-code-review
description: Reviews a diff against Fuutu Stack architecture, security and i18n rules (package boundaries, env access, auth guards, IDOR, rate limits, translations, tests) and reports findings by severity. Use before merging or when the user asks for a review.
metadata:
  fuutu-source: mcp
  fuutu-category: workflow
---

# Code review

Full, version-matched review checklist is served by the **Fuutu MCP** server.

1. If the `fuutu` MCP server is connected, call `skills_get` with `{ "name": "fuutu-code-review" }` and follow the returned instructions exactly.
2. Otherwise review against `AGENTS.md` (architecture, security, i18n, testing sections) and report findings as critical / important / minor with `file:line`.
