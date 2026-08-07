import { createLogger } from "@fuutu/logs";
import { searchConfig } from "./config";
import { meilisearchProvider } from "./providers/meilisearch";
import { noopProvider } from "./providers/noop";
import { postgresProvider } from "./providers/postgres";
import { typesenseProvider } from "./providers/typesense";
import type { SearchProvider } from "./types";

const log = createLogger({ scope: "search:resolve" });

/**
 * Resolve the active search provider from `searchConfig.provider`.
 */
export function resolveSearchProvider(): SearchProvider {
	switch (searchConfig.provider) {
		case "postgres":
			return postgresProvider;
		case "meilisearch":
			return meilisearchProvider;
		case "typesense":
			return typesenseProvider;
		case "noop":
			return noopProvider;
		default:
			log.warn(
				`unknown provider "${searchConfig.provider}", falling back to noop.`,
			);
			return noopProvider;
	}
}
