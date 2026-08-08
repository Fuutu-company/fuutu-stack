export { searchConfig } from "./config";
export { resolveSearchProvider } from "./provider";
export { meilisearchProvider } from "./providers/meilisearch";
export { noopProvider } from "./providers/noop";
export { postgresProvider } from "./providers/postgres";
export { typesenseProvider } from "./providers/typesense";
export type {
	SearchConfig,
	SearchDocument,
	SearchProvider,
	SearchProviderId,
	SearchQuery,
	SearchResult,
} from "./types";
