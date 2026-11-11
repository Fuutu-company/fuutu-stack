---
name: brainstorm-feature
description: Use when the user asks for a new feature, a behavior change, a new page, endpoint or data model, or describes an idea that is not yet specified well enough to build — before writing any code.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Brainstorm a feature

Goal: the user and you agree on **what** gets built and **why**, before any code exists. Output: an approved design, scaled to the size of the work.

<HARD-GATE>
No code, no scaffolding, no file edits outside the design doc until the user has approved the design they actually saw. "Sounds good" to an idea is not approval of a document they have not read.
</HARD-GATE>

## 1. Size the request first

Decide which case you are in and say it in one line:

- **Fully specified** (exact behavior, location, data) → skip to the design summary, ask for a go.
- **One obvious design** → put that design in your first reply and ask for approval or corrections.
- **Open** → continue with step 2.

## 2. Learn before you ask

Read the owning package (`packages/<domain>/`), its public exports, existing callers and similar features. If the `fuutu` MCP server is connected, call `docs_search` / `rules_get` for the domain. Never ask the user something the repo already answers.

## 3. Ask only what changes the outcome

- Start with **why**: one open question about the goal or the problem — no options yet.
- After that, one question per message. Offer 2–4 named options **with your recommendation** only once the intent is clear.
- A question is worth asking only if different answers lead to different builds. Everything else: decide, state it as a proposal, let the user correct it.
- Process choices (file locations, doc format, test layout) are yours — announce, don't ask.
- Ask which technical choices the user wants to own (provider, library, data shape). If they hand them over, pick the kit default and say so.

## 4. Play back what you understood

Every few answers, summarize the current understanding in a short block. Mark clearly what **the user said** versus what **you assume**.

## 5. Propose approaches

In a message of its own: 2–3 approaches, each with trade-offs (effort, risk, fit with the kit's package-first + provider architecture), and your recommendation.

## 6. Write the design

Scale to the work:
- **Small** (one module, < ~1 day): a short design in chat.
- **Larger**: `docs/specs/YYYY-MM-DD-<topic>-design.md` (local working doc) with: goal, non-goals, user-visible behavior, data model, API surface (procedures, permissions), UI states, i18n keys, error cases, tests, open questions.

## 7. Builder check

Before showing it: read the design as the engineer who must build it (or ask a fresh subagent to). List every point they would have to guess. Sort into:
1. already answered → no action
2. minor → decide, mark as `Decision:` in the doc
3. only the user can answer → ask them once, together

## 8. Approval and hand-off

Show the design, wait for an explicit yes. Then use the `plan-implementation` skill — nothing else.

**Spikes:** a throwaway prototype the user approved may skip the gate. Keeping its code is a new request and goes through this skill again.
