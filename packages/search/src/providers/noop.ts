import type { SearchProvider } from "../types";

/**
 * Noop provider — returns empty results (for testing).
 */
export const noopProvider: SearchProvider = {
	id: "noop",
	search: () => Promise.resolve([]),
	index: () => Promise.resolve(),
};
