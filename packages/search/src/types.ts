/**
 * @fuutu/search — provider-agnostic full-text search interface.
 *
 * v1 uses Postgres LIKE queries via @fuutu/db. tsvector can be added
 * later without changing the interface.
 */

export type SearchProviderId =
	| "postgres"
	| "meilisearch"
	| "typesense"
	| "noop";

export interface SearchQuery {
	text: string;
	collection?: string;
	limit?: number;
	offset?: number;
	filters?: Record<string, unknown>;
}

export interface SearchResult {
	id: string;
	collection: string;
	title: string;
	snippet: string;
	score: number;
}

export interface SearchDocument {
	id: string;
	title: string;
	content: string;
	collection: string;
}

export interface SearchProvider {
	readonly id: string;
	search(query: SearchQuery): Promise<SearchResult[]>;
	index(collection: string, documents: SearchDocument[]): Promise<void>;
}

export interface SearchConfig {
	provider: SearchProviderId;
	defaultLimit: number;
}
