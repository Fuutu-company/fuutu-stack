import type { AppNavItem } from "@/lib/nav";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Sidebar items of your desktop app, merged into the kit's (Home,
 * Settings, Account) by `buildNav` (`src/lib/nav.ts`). Your pages are new
 * route files — `src/app/(main)/<route>/page.tsx` (static export: link
 * them with the trailing slash, `/projects/`); the kit ships no other
 * routes there.
 *
 * - `titleKey`: key under `desktop.shell.nav`; add it in every locale via
 *   `packages/i18n/translations/<locale>/app/index.ts` (`desktop` section).
 * - `after`: `home` | `settings` | `account`; omitted → appended.
 *
 * ```ts
 * import { FolderKanban } from "lucide-react";
 * export const appNavItems: AppNavItem[] = [
 *   { titleKey: "projects", href: "/projects/", icon: FolderKanban, after: "home" },
 * ];
 * ```
 */
export const appNavItems: AppNavItem[] = [];
