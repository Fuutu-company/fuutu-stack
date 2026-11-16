/**
 * A public-route entry: a string matches by path prefix on a segment
 * boundary (`"/api/hooks"` covers `/api/hooks` and `/api/hooks/x`, never
 * `/api/hooksx`), `{ exact }` matches only that path.
 */
export type PublicPathEntry = string | { readonly exact: string };

function matchesPrefix(pathname: string, prefix: string): boolean {
	if (pathname === prefix) return true;
	return pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
}

/** True when `pathname` matches any entry of a public-route list. */
export function matchesPublicPath(
	pathname: string,
	entries: readonly PublicPathEntry[],
): boolean {
	return entries.some((entry) =>
		typeof entry === "string"
			? matchesPrefix(pathname, entry)
			: pathname === entry.exact,
	);
}
