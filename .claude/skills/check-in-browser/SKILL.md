---
name: check-in-browser
description: Use after any change to pages, layouts, components, client hooks, providers, translations, routing, next.config.ts or proxy.ts — before calling UI work done.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Check it in a real browser

Green tests do not prove the UI works: hydration errors, blank renders, missing translations and broken routes routinely pass CI. The browser is the final gate.

## Steps

1. **List affected routes** from the diff — both apps if both changed, every locale in `i18nConfig.locales` (`packages/i18n/config.ts`; marketing URLs are locale-prefixed), signed-in and signed-out states, and mobile width for layout changes.
2. **Start the app** in the background and wait until it is ready: `pnpm dev:saas` (:3000), `pnpm dev:marketing` (:3001), `pnpm dev:docs` (:4000). Seeded login: `pnpm db:seed` → `admin@fuutu.local` / `DevPassword!2345`.
3. **Visit each route** with your browser tool (e.g. Playwright MCP). Confirm the expected content renders — not just that the page loads.
4. **Read the console**: zero errors **and** zero warnings. Each one gets a root-cause fix (`debug-root-cause`) — never filter or silence it.
5. **Exercise the change**: click the new button, submit the form, switch locale, resize.
6. **Screenshot** visual changes and look at them.

## Report

Per route: URL, state (locale, signed in), result, console status. Example: `/de/pricing (signed out) — renders, console clean`.

## No browser tool available?

Say so plainly, list the routes and what to check, and ask the user to verify. Never report UI work as verified without having seen it.

Pixel baselines are separate: `apps/*/tests/visual.spec.ts` (`pnpm test:visual:update` after intended visual changes).
