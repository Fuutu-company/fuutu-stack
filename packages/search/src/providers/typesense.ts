import type { SearchProvider } from "../types";

/**
 * Typesense provider — skeleton (not implemented in v1).
 * Returned by the resolver so a misconfigured deploy fails loudly on
 * first call.
 */
export const typesenseProvider: SearchProvider = {
	id: "typesense",
	search: () =>
		Promise.reject(
			new Error("[search:typesense] not implemented — skeleton provider."),
		),
	index: () =>
		Promise.reject(
			new Error("[search:typesense] not implemented — skeleton provider."),
		),
};
