---
name: check-in-browser
description: Use after any change to pages, layouts, components, client hooks, providers, translations, routing, next.config.ts or proxy.ts — before calling UI work done.
metadata:
  fuutu-source: repo
  fuutu-category: workflow
---

# Check it in a real browser

Green tests do not prove the UI works: hydration errors, blank renders, missing translations and broken routes routinely pass CI. The browser is the final gate.

## The session browser

Every coding session has one visible browser the developer watches: `pnpm dev:session` (started automatically by the Claude Code `SessionStart` hook) runs DB, migrations and all three apps on this project's port slot (`pnpm ports`; slot 0 = SaaS :3000, Marketing :3001, Docs :4000) and opens Chromium with remote debugging on the slot's browser port. The Playwright MCP connects to it (`--cdp-endpoint`), so every browser action happens where the developer can see it.

- **Session tabs** (Marketing, Docs, SaaS signed in as `admin@fuutu.local`): only the main session navigates them, and they are never closed.
- **Your own tab:** open a new tab for your work and mark it with your role right after each full page load, so the developer knows who works where:
  `() => { const p = "[qa] "; const fix = () => { if (!document.title.startsWith(p)) document.title = p + document.title; }; fix(); new MutationObserver(fix).observe(document.head, { subtree: true, childList: true, characterData: true }); }`
  (run with `browser_evaluate`; use your role: `lead`, `builder`, `qa`, …). Close your tab when done — leave it open only when it shows a failure you report.
- **Another login** (member, signed-out user): open a separate window with its own context, also role-prefixed. Never sign the session tabs out.
- The session browser is Playwright's Chrome for Testing (started with `--disable-infobars`); set `FUUTU_SESSION_BROWSER` to another Chromium-based binary to use that instead.
- **Never stop** the apps or the browser at the end — the developer reviews afterwards. `pnpm dev:session stop` is theirs.
- E2E suites (`pnpm test:e2e:*`) stay headless and separate from the session browser.

## Steps

1. **List affected routes** from the diff — both apps if both changed, every locale in `i18nConfig.locales` (`packages/i18n/config.ts`; marketing URLs are locale-prefixed), signed-in and signed-out states, and mobile width for layout changes.
2. **Make sure the session runs:** `pnpm dev:session status`; if something is down, `pnpm dev:session` (reuses what is up).
3. **Visit each route in your own tab** of the session browser. Confirm the expected content renders — not just that the page loads.
4. **Read the console**: zero errors **and** zero warnings. Each one gets a root-cause fix (`debug-root-cause`) — never filter or silence it.
5. **Exercise the change**: click the new button, submit the form, switch locale, resize.
6. **Screenshot** visual changes and look at them.

## Report

Per route: URL, state (locale, signed in), result, console status. Example: `/de/pricing (signed out) — renders, console clean`.

## No browser tool available?

Say so plainly, list the routes and what to check, and ask the user to verify. Never report UI work as verified without having seen it.

Pixel baselines are separate: `apps/*/tests/visual.spec.ts` (`pnpm test:visual:update` after intended visual changes).
