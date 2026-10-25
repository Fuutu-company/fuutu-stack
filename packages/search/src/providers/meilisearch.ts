import type { SearchProvider } from "../types";

/**
 * Meilisearch provider — skeleton (not implemented in v1).
 * Returned by the resolver so a misconfigured deploy fails loudly on
 * first call.
 */
export const meilisearchProvider: SearchProvider = {
	id: "meilisearch",
	search: () =>
		Promise.reject(
			new Error("[search:meilisearch] not implemented — skeleton provider."),
		),
	index: () =>
		Promise.reject(
			new Error("[search:meilisearch] not implemented — skeleton provider."),
		),
};
