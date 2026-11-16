import type { AppMainNavItem } from "./modules/app/components/nav-config";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Top-level sidebar items for the SaaS app's Platform group (next to
 * Dashboard), merged into the kit list by `getMainItems` in
 * `modules/app/components/nav-config.ts` — add yours here instead of
 * editing that file or `nav-main.tsx`.
 *
 * Every item:
 * - `titleKey`: i18n key under `navigation.*` (add it in every locale);
 *   also the item's unique key. Reusing a kit key (`dashboard`, `aiChat`,
 *   `crm`, `notifications`) or another app item's throws when the sidebar
 *   renders; `app-navigation.test.ts` (test-utils) catches it in CI first.
 * - `icon`: a lucide icon component.
 * - one target: `segment` (scoped like the kit items — `/<segment>`, in
 *   an org `/organizations/<slug>/<segment>`), `orgSegment` (org routes
 *   only, hidden elsewhere) or an absolute `href`.
 * - `after`: kit item key to place it behind; omitted, or the anchor is
 *   hidden (e.g. `aiChat` with the flag off), the item is appended.
 * - `enabled`: static feature gate, e.g. `config.features.myFeature`.
 * - `permission`: `PERMISSIONS.*` from `@fuutu/rbac`, checked against the
 *   viewer's org role — shown only inside an org whose role has it.
 *
 * The sidebar is a convenience only — the page itself must still enforce
 * access server-side (layout guard / `authProcedure`).
 *
 * ```ts
 * import { Bot } from "lucide-react";
 * export const appMainNavItems: AppMainNavItem[] = [
 *   { titleKey: "agents", icon: Bot, orgSegment: "agents", after: "dashboard" },
 * ];
 * ```
 */
export const appMainNavItems: AppMainNavItem[] = [];
