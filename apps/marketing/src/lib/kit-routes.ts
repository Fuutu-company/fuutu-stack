import { config } from "@fuutu/config";
import { appKitRoutes } from "../app-site-links";

/** The kit pages an app can switch off (`appKitRoutes` in `app-site-links.ts`). */
export const KIT_ROUTES = [
	"pricing",
	"blog",
	"changelog",
	"contact",
	"download",
] as const;

export type KitRoute = (typeof KIT_ROUTES)[number];

/**
 * Whether a kit page is served: `appKitRoutes[route] !== false`, and
 * `pricing` also needs `config.features.payments`, `download` (the desktop
 * app) `config.features.desktop`. A disabled page 404s
 * (its route folder's `layout.tsx` calls `notFound()`) and disappears from
 * the navbar, footer, sitemap and the home page.
 */
export function isKitRouteEnabled(route: KitRoute): boolean {
	if (appKitRoutes[route] === false) return false;
	if (route === "pricing" && !config.features.payments) return false;
	if (route === "download" && !config.features.desktop) return false;
	return true;
}

/**
 * False for an in-app path (or `/<route>/...`, hash and query ignored)
 * that belongs to a disabled kit page; true for every other path.
 */
export function isKitPathEnabled(path: string): boolean {
	const segment = path.split(/[?#]/)[0]?.split("/")[1];
	const route = KIT_ROUTES.find((candidate) => candidate === segment);
	return route === undefined || isKitRouteEnabled(route);
}
