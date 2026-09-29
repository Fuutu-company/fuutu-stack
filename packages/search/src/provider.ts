import { env } from "@fuutu/env/saas";
import { searchConfig } from "./config";
import { meilisearchProvider } from "./providers/meilisearch";
import { noopProvider } from "./providers/noop";
import { postgresProvider } from "./providers/postgres";
import { typesenseProvider } from "./providers/typesense";
import type { SearchProvider } from "./types";

/**
 * Resolve the active search provider. `SEARCH_PROVIDER` overrides
 * `searchConfig.provider` (same pattern as STORAGE_PROVIDER).
 */
export function resolveSearchProvider(): SearchProvider {
	const configured = env.SEARCH_PROVIDER ?? searchConfig.provider;
	switch (configured) {
		case "postgres":
			return postgresProvider;
		case "meilisearch":
			return meilisearchProvider;
		case "typesense":
			return typesenseProvider;
		case "noop":
			return noopProvider;
		default:
			throw new Error(`Unknown search provider: ${configured}`);
	}
}
