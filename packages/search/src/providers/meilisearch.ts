import type { SearchProvider } from "../types";

/**
 * Meilisearch provider — skeleton (not implemented in v1).
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
