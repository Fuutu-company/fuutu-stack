import { House, type LucideIcon, Settings, UserRound } from "lucide-react";

/** Kit sidebar items (keys under `desktop.shell.nav`). */
export type KitNavKey = "home" | "settings" | "account";

/** One sidebar item of your app (`src/app-nav.ts`). */
export type AppNavItem = {
	/** i18n key under `desktop.shell.nav` (add it in every locale); unique. */
	titleKey: string;
	/** Route of your page, with the trailing slash (`/projects/`). */
	href: `/${string}`;
	icon: LucideIcon;
	/** Place directly after this kit item; omitted → appended. */
	after?: KitNavKey;
	/** Active only on `href` itself, not on its subpaths. */
	exact?: boolean;
};

export type NavItem = {
	titleKey: string;
	href: string;
	icon: LucideIcon;
	exact?: boolean;
};

const KIT_NAV: (NavItem & { titleKey: KitNavKey })[] = [
	{ href: "/", titleKey: "home", icon: House, exact: true },
	{ href: "/settings/", titleKey: "settings", icon: Settings, exact: true },
	{ href: "/settings/account/", titleKey: "account", icon: UserRound },
];

/** Kit items plus the app's (`appNavItems`), in order. */
export function buildNav(app: readonly AppNavItem[]): NavItem[] {
	const nav: NavItem[] = [...KIT_NAV];
	const keys = new Set(nav.map((item) => item.titleKey));
	const tail: NavItem[] = [];
	for (const item of app) {
		if (keys.has(item.titleKey)) {
			throw new Error(`app-nav.ts: duplicate nav key "${item.titleKey}"`);
		}
		if (!/^\/(?!\/)/.test(item.href)) {
			throw new Error(
				`app-nav.ts: "${item.titleKey}" needs an in-app href ("/…/"), got "${item.href}"`,
			);
		}
		keys.add(item.titleKey);
		const entry: NavItem = {
			titleKey: item.titleKey,
			href: item.href,
			icon: item.icon,
			...(item.exact && { exact: true }),
		};
		const anchor = item.after
			? nav.findIndex((n) => n.titleKey === item.after)
			: -1;
		if (anchor === -1) tail.push(entry);
		else {
			// After the anchor and the app items already placed behind it.
			let at = anchor + 1;
			while (at < nav.length && !KIT_NAV.includes(nav[at] as never)) at++;
			nav.splice(at, 0, entry);
		}
	}
	return [...nav, ...tail];
}

export function isNavActive(pathname: string, item: NavItem): boolean {
	return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
