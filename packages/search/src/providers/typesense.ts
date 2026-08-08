import type { SearchProvider } from "../types";

/**
 * Typesense provider — skeleton (not implemented in v1).
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
