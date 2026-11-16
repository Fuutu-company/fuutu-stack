import { useEffect } from "react";

/** `href` as path + query + hash without `name`, or null when it has none. */
export function urlWithoutQueryParam(
	href: string,
	name: string,
): string | null {
	const url = new URL(href);
	if (!url.searchParams.has(name)) return null;
	url.searchParams.delete(name);
	return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Drops a one-time secret (`?token=`) from the address bar once the page
 * has read it — it then stays out of history, shared URLs and Referer
 * headers. Read the value into state first: `useSearchParams()` follows
 * the replaced URL.
 */
export function useStripQueryParam(name: string, value: string | null): void {
	useEffect(() => {
		if (!value) return;
		const next = urlWithoutQueryParam(window.location.href, name);
		if (next !== null) window.history.replaceState(null, "", next);
	}, [name, value]);
}
