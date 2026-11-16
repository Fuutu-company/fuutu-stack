/**
 * A public-route entry: a string matches by prefix (`"/api/hooks"` also
 * covers `/api/hooks/x`), `{ exact }` matches only that path.
 */
export type PublicPathEntry = string | { readonly exact: string };

/** True when `pathname` matches any entry of a public-route list. */
export function matchesPublicPath(
	pathname: string,
	entries: readonly PublicPathEntry[],
): boolean {
	return entries.some((entry) =>
		typeof entry === "string"
			? pathname.startsWith(entry)
			: pathname === entry.exact,
	);
}
