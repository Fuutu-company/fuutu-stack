---
name: brainstorming
description: Turns a feature idea or behavior change into an approved design spec through one-question-at-a-time dialogue, 2-3 alternative approaches, and an explicit user approval gate. Use before any creative or implementation work — new features, components, endpoints, schema changes, or modified behavior — and before writing any code.
license: MIT
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Brainstorming Ideas Into Designs

Turn an idea into a fully formed, approved design through collaborative dialogue. Understand the project first, ask questions one at a time, present the design, get approval.

<HARD-GATE>
Do NOT write code, scaffold files, or take any implementation action until you have presented a design and the user has approved it. This applies to EVERY change regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Design"

"Simple" changes are where unexamined assumptions waste the most work. The design can be three sentences — but you MUST present it and get approval.

## Checklist

1. **Explore project context** — read the relevant packages and apps, recent commits, existing patterns (`AGENTS.md`).
2. **Ask clarifying questions** — one at a time: purpose, constraints, success criteria.
3. **Propose 2-3 approaches** — with trade-offs and your recommendation.
4. **Present the design** — in sections scaled to complexity; confirm each section.
5. **Write the spec** — `docs/specs/YYYY-MM-DD-<topic>-design.md`.
6. **Self-review the spec** — placeholders, contradictions, ambiguity, scope.
7. **User reviews the written spec** — wait for approval.
8. **Hand off** — invoke `writing-plans`. Nothing else.

## The Process

**Understanding the idea**
- Explore before asking: find the owning package (`packages/<domain>/`), its public exports, and existing callers.
- If the `fuutu` MCP server is connected, call `docs_search` / `rules_get` for the relevant domain before designing; otherwise read the package source.
- Assess scope: if the request spans several independent subsystems, say so and decompose into separate specs.
- One question per message. Prefer multiple choice.

**Exploring approaches**
- Lead with your recommendation and explain why.
- Prefer the approach already established in this codebase (provider pattern, package-first, typed query functions in `@fuutu/db`, oRPC procedures in `@fuutu/api`).

**Presenting the design** — cover what applies:
- Architecture and which packages/apps change
- Data model and schema changes (flag these — they are hard to reverse)
- API surface (oRPC procedures, Zod inputs)
- UI and i18n keys (every shipped locale)
- Auth, RBAC, rate limiting, error handling
- Testing: unit (Vitest), E2E (Playwright), browser verification

**Working in existing code**
- Grep for callers and dependencies before proposing changes.
- Include targeted fixes only where existing code blocks the work. No unrelated refactors.

## After the Design

Write the spec to `docs/specs/YYYY-MM-DD-<topic>-design.md`. `/docs/` is gitignored — specs are local working docs, not committed.

**Spec self-review**
1. **Placeholders** — any "TBD", "TODO", empty sections? Fix them.
2. **Consistency** — do sections contradict each other?
3. **Scope** — small enough for a single implementation plan?
4. **Ambiguity** — could a requirement be read two ways? Pick one, make it explicit.

**User review gate**
> "Spec written to `<path>`. Please review it and tell me about any changes before I write the implementation plan."

Wait for approval. Then invoke `writing-plans` — no other skill, no code.

## Key Principles

- **One question at a time** — don't overwhelm.
- **Multiple choice preferred** — easier to answer.
- **YAGNI ruthlessly** — cut features nobody asked for.
- **Always explore alternatives** — 2-3 approaches, not one.
- **Incremental validation** — approval before moving on.
- **Explore before proposing** — know the callers before suggesting changes.
