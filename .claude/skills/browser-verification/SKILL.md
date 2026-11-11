---
name: browser-verification
description: Drives a real browser through every route affected by a change, confirms each page renders the expected content, and requires a console with zero errors and zero warnings before work is called done. Use after any change touching pages, layouts, components, client hooks, providers, i18n routing, next.config.ts, or proxy.ts — passing tests are not enough.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Browser Verification

The real browser is the final gate. Green `pnpm check`, `pnpm check-types`, and E2E do **not** prove the UI works — console errors, hydration mismatches, blank renders, and dead routes routinely survive the test suite.

## When to Use

Any change to what a user sees or how a route loads:
- `apps/{saas,marketing}/src/app/**` — pages, layouts, `loading`/`error`/`not-found`
- `packages/ui/**`, `apps/*/src/modules/**` components
- client hooks and providers (`"use client"`, theme, consent, analytics)
- `next.config.ts` (CSP, headers), `proxy.ts`, i18n routing, translation files
- anything in `<head>`: metadata, scripts, fonts, images

Skip only for changes with zero UI surface (pure package logic, CLI scripts, CI config).

## Tooling

Use whatever browser automation you have — e.g. the Playwright MCP server (`browser_navigate`, `browser_snapshot`, `browser_console_messages`, `browser_click`, `browser_take_screenshot`). If no browser tool is available, say so explicitly and ask the user to verify the listed routes; never report UI work as verified without it.

## Protocol

1. **List affected routes** from the diff. Cover both apps if both changed, every shipped locale (`i18nConfig.locales` in `packages/i18n/config.ts`; marketing URLs are locale-prefixed), and authed + unauthed states.
2. **Start the dev server** — `pnpm dev:saas` (port 3000) and/or `pnpm dev:marketing` (port 3001), or `pnpm dev` for all. Run it in the background and wait until it reports ready.
3. **Navigate each route.** Read the page snapshot — confirm the expected content rendered, not a blank or error shell.
4. **Read the console after every navigation.** Bar: **0 errors, 0 warnings.** Hydration warnings, failed fetches, asset 404s, chunk-load failures, React key warnings, CSP violations — all count.
5. **Exercise the affected flows** — sign-in, locale switch, dialog, form submit. Re-check the console after each interaction.
6. **Screenshot** when the change is visual or a regression is plausible.
7. **Fix root causes** — never suppress an error to clear the bar (no swallowing `try/catch`, no `console.error` overrides, no test-side filtering). Pre-existing errors on routes you didn't touch: report them separately and continue.
8. **Stop the dev server** when done.
9. **Report** — routes visited, console status per route, flows exercised, fixes applied, pre-existing issues.

## Rules

- **Console errors block "done"** — a route with console errors is a failed verification, same weight as red `check-types`.
- **Every locale matters** — a layout that breaks only with longer German strings is still a bug.
- **Authed + unauthed** — protected routes must redirect anonymous users; verify the redirect target renders too.
- **Drive the browser yourself** — don't delegate to a subagent that lacks browser access.

## What This Is Not

- Not a replacement for E2E — run both. E2E proves flows; this catches render and console problems E2E doesn't assert on.
- Not a visual-regression baseline — `toHaveScreenshot()` lives in `apps/*/tests/visual.spec.ts`.
- Not a full walkthrough for every copy tweak — a translation change still warrants loading the route, not the whole flow.

## Red Flags — STOP

- Claiming "the UI works" without navigating to the changed route this session
- "E2E passed, so the browser is fine"
- Suppressing a console error to clear the bar
- Skipping a locale because "it's the same"
