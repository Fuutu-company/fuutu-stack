import { consentBannerVisible } from "@fuutu/analytics";
import { insertAfter } from "@fuutu/utils/insert-after";
import type { LucideIcon } from "lucide-react";
import { BookOpen, Rss, Terminal } from "lucide-react";
import type { ComponentType, ReactElement } from "react";
import {
	appFooter,
	appFooterColumns,
	appHeaderBrand,
	appNavDropdownItems,
	appNavDropdowns,
	appNavItems,
	appNavRemove,
} from "../app-site-links";
import { PrivacySettingsAction } from "../modules/marketing/components/privacy-settings-action";
import { isKitPathEnabled } from "./kit-routes";
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

/**
 * App dropdown item (`app-site-links.ts`): into the kit dropdown `group`
 * (`resources`), `after` an item key of that group, or appended.
 */
export type AppNavDropdownItem = NavDropdownItem & {
	group: string;
	after?: string;
};

/**
 * Navbar brand (`app-site-links.ts`), inside the home link: `Brand`
 * replaces the kit logo mark + app name, `After` renders behind them (a
 * badge, a second mark). Client components; unset keeps the kit brand.
 */
export type AppHeaderBrand = {
	Brand?: ComponentType;
	After?: ComponentType;
};

/**
 * App dropdown group (`app-site-links.ts`): a top-level navbar dropdown,
 * `after` a nav item or dropdown key, or appended after the kit dropdowns.
 */
export type AppNavDropdown = NavDropdown & { after?: string };

/** Top-level navbar entry: a link (`NAV_ITEMS`) or a dropdown (`NAV_DROPDOWNS`). */
export type NavEntry = { kind: "item" | "dropdown"; key: string };

/**
 * Footer overrides (`app-site-links.ts`): `taglineKey` = full translation
 * key of the line under the logo (an app-owned key; unset: `footer.tagline`).
 * `areaLine` = the bottom-row line next to the 4-dot area mark: `false`
 * removes it, `textKey` replaces its text (unset: `footer.areas`), `Mark`
 * replaces the mark (a client-safe component) or `null` drops it.
 */
export type AppFooter = {
	taglineKey?: string;
	areaLine?: false | { textKey?: string; Mark?: ComponentType | null };
	/** Footer entries that open UI (a dialog) instead of navigating. */
	actions?: readonly AppFooterAction[];
};

/**
 * A footer button in a column, after its links. The kit renders the
 * trigger — a `<button type="button">` styled like the footer links,
 * labelled `t(labelKey)` — and hands it to `Component`, a client
 * component that wires it up, e.g.
 * `<Dialog><DialogTrigger asChild>{trigger}</DialogTrigger>…</Dialog>`.
 */
export type AppFooterAction = {
	/** Unique among the actions (React key). */
	key: string;
	/** Column `titleKey` — a kit column (`product`, `resources`, `companyAndLegal`) or an app column. */
	column: string;
	/** Full translation key of the button label. */
	labelKey: string;
	Component: ComponentType<{ trigger: ReactElement }>;
};

/** Footer area line: `Mark` undefined = the kit area mark, `null` = none. */
export type FooterAreaLine = {
	textKey: string;
	Mark: ComponentType | null | undefined;
};

/** Navbar brand: the app's parts (`appHeaderBrand`), else the kit logo + name. */
export const HEADER_BRAND: AppHeaderBrand = appHeaderBrand;

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

/**
 * Desktop navbar top level, left to right: `NAV_ITEMS`, then
 * `NAV_DROPDOWNS` — app dropdowns may sit between items. The mobile menu
 * lists the links first, then every dropdown group.
 */
export const NAV_ORDER: NavEntry[] = [];

/** Translation key of the footer tagline. */
export const FOOTER_TAGLINE_KEY = appFooter.taglineKey ?? "footer.tagline";

/** Footer bottom-row area line; `null` when the app removed it. */
export const FOOTER_AREA_LINE: FooterAreaLine | null =
	appFooter.areaLine === false
		? null
		: {
				textKey: appFooter.areaLine?.textKey ?? "footer.areas",
				Mark: appFooter.areaLine?.Mark,
			};

/** Footer link columns (titles resolve `footer.<titleKey>`). */
export const FOOTER_COLUMNS: FooterColumn[] = [
	{
		titleKey: "product",
		links: [
			{ href: "/#features", labelKey: "nav.features" },
			{ href: "/pricing", labelKey: "nav.pricing" },
			{ href: "/changelog", labelKey: "nav.changelog" },
			{ href: "/download", labelKey: "nav.download" },
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
NAV_ORDER.push(
	...insertAfter<NavEntry>(
		[
			...NAV_ITEMS.map((item) => ({ kind: "item" as const, key: item.key })),
			...NAV_DROPDOWNS.map((group) => ({
				kind: "dropdown" as const,
				key: group.key,
			})),
		],
		appNavDropdowns.map(({ after, key }) => ({
			after,
			item: { kind: "dropdown", key },
		})),
		(entry) => entry.key,
	),
);
const allDropdowns: NavDropdown[] = [
	...NAV_DROPDOWNS,
	...appNavDropdowns.map(({ after: _after, ...group }) => ({
		...group,
		items: [...group.items],
	})),
];
NAV_DROPDOWNS.splice(
	0,
	NAV_DROPDOWNS.length,
	...NAV_ORDER.flatMap((entry) =>
		allDropdowns.filter(
			(group) => entry.kind === "dropdown" && group.key === entry.key,
		),
	),
);
for (const extra of appNavDropdownItems) {
	if (!NAV_DROPDOWNS.some((g) => g.key === extra.group)) {
		throw new Error(
			`app-site-links: unknown dropdown group "${extra.group}" (item "${extra.key}")`,
		);
	}
}
for (const group of NAV_DROPDOWNS) {
	group.items = insertAfter(
		group.items,
		appNavDropdownItems
			.filter((extra) => extra.group === group.key)
			.map(({ group: _group, after, ...item }) => ({ after, item })),
		(item) => item.key,
	);
}
// Removals last, so app entries anchored on a removed key keep its spot.
if (appNavRemove.length > 0) {
	const remove = new Set(appNavRemove);
	for (const key of remove) {
		const known =
			NAV_ORDER.some((entry) => entry.key === key) ||
			NAV_DROPDOWNS.some((group) => group.items.some((i) => i.key === key));
		if (!known) {
			throw new Error(
				`app-site-links: unknown nav key "${key}" in appNavRemove`,
			);
		}
	}
	for (const group of NAV_DROPDOWNS) {
		group.items = group.items.filter((item) => !remove.has(item.key));
	}
	const keep = <T extends { key: string }>(list: T[]) =>
		list.splice(0, list.length, ...list.filter((e) => !remove.has(e.key)));
	keep(NAV_ITEMS);
	keep(NAV_DROPDOWNS);
	keep(NAV_ORDER);
}
// Links to switched-off kit pages (`appKitRoutes`, payments off) go away;
// a dropdown left without items goes with them.
const navLinkEnabled = (link: { href: string; external?: boolean }) =>
	link.external || isKitPathEnabled(link.href);
NAV_ITEMS.splice(0, NAV_ITEMS.length, ...NAV_ITEMS.filter(navLinkEnabled));
for (const group of NAV_DROPDOWNS) {
	group.items = group.items.filter(navLinkEnabled);
}
NAV_DROPDOWNS.splice(
	0,
	NAV_DROPDOWNS.length,
	...NAV_DROPDOWNS.filter((group) => group.items.length > 0),
);
NAV_ORDER.splice(
	0,
	NAV_ORDER.length,
	...NAV_ORDER.filter((entry) =>
		(entry.kind === "item" ? NAV_ITEMS : NAV_DROPDOWNS).some(
			(candidate) => candidate.key === entry.key,
		),
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

/**
 * Footer buttons, rendered after their column's links: the kit's "Privacy
 * settings" (reopens the consent banner; only while the banner is on),
 * then the app's (`appFooter.actions`).
 */
export const FOOTER_ACTIONS: AppFooterAction[] = consentBannerVisible()
	? [
			{
				key: "privacySettings",
				column: "companyAndLegal",
				labelKey: "consent.privacySettings",
				Component: PrivacySettingsAction,
			},
		]
	: [];
for (const action of appFooter.actions ?? []) {
	if (!FOOTER_COLUMNS.some((c) => c.titleKey === action.column)) {
		throw new Error(
			`app-site-links: unknown footer column "${action.column}" (action "${action.key}")`,
		);
	}
	if (FOOTER_ACTIONS.some((a) => a.key === action.key)) {
		throw new Error(
			`app-site-links: duplicate footer action key "${action.key}"`,
		);
	}
	FOOTER_ACTIONS.push(action);
}

// Footer links to switched-off kit pages go away; so do columns left empty
// (unless a footer action sits in them).
for (const column of FOOTER_COLUMNS) {
	column.links = column.links.filter(navLinkEnabled);
}
FOOTER_COLUMNS.splice(
	0,
	FOOTER_COLUMNS.length,
	...FOOTER_COLUMNS.filter(
		(column) =>
			column.links.length > 0 ||
			FOOTER_ACTIONS.some((action) => action.column === column.titleKey),
	),
);
