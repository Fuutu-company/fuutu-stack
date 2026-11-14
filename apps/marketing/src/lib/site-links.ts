import { insertAfter } from "@fuutu/utils/insert-after";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Rss, Terminal } from "lucide-react";
import { appFooterColumns, appNavItems } from "../app-site-links";
import { urls } from "./urls";

/**
 * Marketing navigation + footer links — edit this file to change them;
 * the navbar and footer components only render it.
 *
 * Labels are i18n keys: nav items resolve `nav.<key>` (dropdown items also
 * `nav.descriptions.<key>`), footer links the full `labelKey`. Add new keys
 * to every enabled locale under `packages/i18n/translations/<locale>/marketing/`.
 * `href`: in-app path (locale-prefixed automatically), `#hash` link with
 * `hash: true`, or an absolute URL with `external: true`.
 * App-only links go in `src/app-site-links.ts` (merged at the end of this
 * file).
 */

export type NavItem = {
	key: string;
	href: string;
	external?: boolean;
	hash?: boolean;
	badgeKey?: string;
};

export type NavDropdownItem = {
	key: string;
	href: string;
	external?: boolean;
	hash?: boolean;
	icon: LucideIcon;
};

export type NavDropdown = { key: string; items: NavDropdownItem[] };

export type FooterLink = { href: string; labelKey: string; external?: boolean };

export type FooterColumn = { titleKey: string; links: FooterLink[] };

/** App navbar item (`app-site-links.ts`): `after` a nav key, or appended. */
export type AppNavItem = NavItem & { after?: string };

/** Top-level navbar links, left to right. */
export const NAV_ITEMS: NavItem[] = [
	{ key: "home", href: "/" },
	{ key: "features", href: "/#features", hash: true },
	{ key: "pricing", href: "/pricing" },
];

/** Navbar dropdown menus, rendered after `NAV_ITEMS`. */
export const NAV_DROPDOWNS: NavDropdown[] = [
	{
		key: "resources",
		items: [
			{ key: "blog", href: "/blog", icon: Rss },
			{ key: "changelog", href: "/changelog", icon: Terminal },
			{ key: "docs", href: urls.docs, external: true, icon: BookOpen },
		],
	},
];

/** Footer link columns (titles resolve `footer.<titleKey>`). */
export const FOOTER_COLUMNS: FooterColumn[] = [
	{
		titleKey: "product",
		links: [
			{ href: "/#features", labelKey: "nav.features" },
			{ href: "/pricing", labelKey: "nav.pricing" },
			{ href: "/changelog", labelKey: "nav.changelog" },
		],
	},
	{
		titleKey: "resources",
		links: [
			{ href: urls.docs, labelKey: "nav.docs", external: true },
			{ href: "/blog", labelKey: "nav.blog" },
		],
	},
	{
		titleKey: "companyAndLegal",
		links: [
			{ href: "/contact", labelKey: "footer.contact" },
			{ href: "/legal/privacy", labelKey: "footer.privacy" },
			{ href: "/legal/terms", labelKey: "footer.terms" },
			{ href: "/legal/imprint", labelKey: "footer.imprint" },
		],
	},
];

// ─── App links (`src/app-site-links.ts`) — merged in place, kit links stay ───
NAV_ITEMS.splice(
	0,
	NAV_ITEMS.length,
	...insertAfter(
		NAV_ITEMS,
		appNavItems.map(({ after, ...item }) => ({ after, item })),
		(item) => item.key,
	),
);
for (const column of appFooterColumns) {
	if (FOOTER_COLUMNS.some((c) => c.titleKey === column.titleKey)) {
		throw new Error(
			`app-site-links: duplicate footer titleKey "${column.titleKey}"`,
		);
	}
	FOOTER_COLUMNS.push(column);
}
