import {
	KIT_FINGERPRINT_HEADER_NAME,
	KIT_FINGERPRINT_HEADER_VALUE,
} from "@fuutu/config";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Docs proxy — i18n routing + kit-fingerprint stamping.
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

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt|mp4|mp3|webm|ogg|wav)$).*)",
	],
};
