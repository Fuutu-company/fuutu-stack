import type { KitRoute } from "./lib/kit-routes";
import type {
	AppFooter,
	AppHeaderBrand,
	AppNavDropdown,
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

/**
 * Top-level navbar dropdowns (a "Product" menu), `after` a nav item key
 * (`home`, `features`, `pricing`, or an app item) or dropdown key
 * (`resources`), appended when omitted. Labels resolve `nav.<key>`, items
 * `nav.<item>` + `nav.descriptions.<item>`; `appNavDropdownItems` can add
 * to them by `group`. A key that already exists throws.
 *
 * ```ts
 * export const appNavDropdowns: AppNavDropdown[] = [
 *   { key: "product", after: "features", items: [
 *     { key: "agents", href: "/agents", icon: Bot },
 *   ] },
 * ];
 * ```
 */
export const appNavDropdowns: readonly AppNavDropdown[] = [];

/**
 * Kit navbar entries to hide, by key: top-level items (`home`,
 * `features`, `pricing`), dropdown groups (`resources`) or dropdown items
 * (`blog`, `changelog`, `docs`). Applied after the app additions; an
 * unknown key throws. Footer links are not affected.
 *
 * ```ts
 * export const appNavRemove: readonly string[] = ["home", "features"];
 * ```
 */
export const appNavRemove: readonly string[] = [];

/**
 * Footer overrides: `taglineKey` names an app-owned translation key for the
 * line under the logo, so kit translation values stay untouched.
 * `areaLine` changes the bottom-row "Four areas, one product." line and its
 * 4-dot area mark: `false` removes both, `textKey` names an app-owned key
 * for the text, `Mark` a client-safe component for the mark (`null` drops
 * the mark). Unset keeps the kit line.
 *
 * ```ts
 * export const appFooter: AppFooter = {
 *   taglineKey: "brand.footerTagline",
 *   areaLine: { textKey: "brand.footerLine", Mark: BrandDot },
 * };
 * ```
 */
export const appFooter: AppFooter = {};

/**
 * Kit pages to switch off, by key: `pricing`, `blog`, `changelog`,
 * `contact`, `download`. A page set to `false` answers 404 (every locale), and its
 * navbar and footer links, sitemap entries and (for `pricing`) the home
 * pricing section and (for `contact`) the home security-band button
 * disappear; links you add yourself (`appNavItems`, `notFoundLinks`) to
 * a disabled page are dropped too. `pricing` is also off while
 * `config.features.payments` is `false`. Legal pages and the home page
 * stay — control those through their own config and `appMarketing`.
 * The kit E2E specs read this too (`isKitRouteEnabled` in
 * `lib/kit-routes.ts`): they skip a switched-off page and assert it is gone,
 * so nothing needs excluding in `tests/app-excluded.ts`. Keep this file
 * importable from Node (Playwright imports it).
 *
 * ```ts
 * export const appKitRoutes: Partial<Record<KitRoute, false>> = {
 *   blog: false,
 *   changelog: false,
 * };
 * ```
 */
export const appKitRoutes: Partial<Record<KitRoute, false>> = {};
