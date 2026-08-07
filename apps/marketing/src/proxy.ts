import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Marketing proxy — i18n routing + kit-fingerprint stamping.
 *
 * The fingerprint header is also set in `next.config.ts`; we
 * stamp it here as well so it survives middleware-level rewrites and
 * gives the Fuutu compliance crawler a second emission point. Removing
 * it is a license violation (LICENSE.md §6(5), §7).
 */
export default async function proxy(req: NextRequest) {
	const response = await intlMiddleware(req);
	response.headers.set(
		KIT_FINGERPRINT_HEADER_NAME,
		KIT_FINGERPRINT_HEADER_VALUE,
	);
	return response;
}

/**
 * Matcher configuration - exclude static assets and Next.js internals
 */
export const config = {
	matcher: [
		// Exclude Next.js internals, asset extensions, and the static metadata
		// routes Next renders directly (sitemap, robots, manifest). next-intl
		// would otherwise rewrite `/sitemap.xml` → `/en/sitemap.xml` and 404.
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|mp4|mp3|webm|ogg|wav)$).*)",
	],
};
