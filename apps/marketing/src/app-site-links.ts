import type {
	AppHeaderBrand,
	AppNavDropdownItem,
	AppNavItem,
	FooterColumn,
} from "./lib/site-links";

/**
 * App-owned — the kit never changes this file's content after release;
 * fill it for your app.
 *
 * Extra navbar items and footer columns, merged into the kit links by
 * `lib/site-links.ts` (kit links stay) — add yours here instead of
 * editing that file. Read by the navbar (a client component): import
 * only client-safe modules here.
 *
 * - `appNavItems`: top-level navbar links; `after` a kit key (`home`,
 *   `features`, `pricing`) or appended. Labels resolve `nav.<key>`; a
 *   key that already exists throws.
 * - `appFooterColumns`: columns appended after the kit columns (titles
 *   resolve `footer.<titleKey>`, links their full `labelKey`); a
 *   `titleKey` that already exists throws.
 *
 * Add every label key to all locales under
 * `packages/i18n/translations/<locale>/marketing/`.
 *
 * ```ts
 * export const appNavItems: AppNavItem[] = [
 *   { key: "showcase", href: "/showcase", after: "features" },
 * ];
 * ```
 */
export const appNavItems: readonly AppNavItem[] = [];

export const appFooterColumns: readonly FooterColumn[] = [];

/**
 * Items in a kit navbar dropdown `group` (`resources`), `after` an item key
 * of that group (`blog`, `changelog`, `docs`) or appended. Labels resolve
 * `nav.<key>` + `nav.descriptions.<key>`; an unknown group or an existing
 * key throws.
 *
 * ```ts
 * export const appNavDropdownItems: AppNavDropdownItem[] = [
 *   { group: "resources", key: "guides", href: "/guides", icon: Compass, after: "blog" },
 * ];
 * ```
 */
export const appNavDropdownItems: readonly AppNavDropdownItem[] = [];

/**
 * Navbar brand, inside the home link: `Brand` replaces the kit logo mark +
 * app name, `After` renders behind them (a badge). Client components.
 *
 * ```ts
 * export const appHeaderBrand: AppHeaderBrand = { After: BetaBadge };
 * ```
 */
export const appHeaderBrand: AppHeaderBrand = {};
