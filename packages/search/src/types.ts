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
	/**
	 * Tenant scope — at least one is required by tenant-scoped providers
	 * (postgres). `userId` scopes user-owned rows (notifications, audit
	 * logs); `organizationId` scopes audit logs to org members.
	 *
	 * Caller MUST derive scope from authenticated context (e.g.
	 * `context.user.id` or an org-permission check). Providers enforce
	 * scope presence, not correctness — passing a foreign id returns
	 * that tenant's rows.
	 */
	userId?: string;
	/**
	 * When both `userId` and `organizationId` are set, `userId` wins for
	 * the audit-logs scope (auditScope precedence in the postgres
	 * provider).
	 */
	organizationId?: string;
	/**
	 * Provider-specific. Postgres supports `type` (notifications) and
	 * `action` (audit-logs); unknown keys are ignored.
	 */
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
	/**
	 * Tenant scope stamped at index time — shared-index providers MUST
	 * filter on it. `userId` marks user-owned docs, `organizationId`
	 * org-owned docs.
	 */
	userId?: string;
	organizationId?: string;
}

export interface SearchProvider {
	readonly id: string;
	search(query: SearchQuery): Promise<SearchResult[]>;
	/**
	 * No-op for providers that index at write time (postgres); required
	 * for external engines (meilisearch, typesense).
	 */
	index(collection: string, documents: SearchDocument[]): Promise<void>;
}

export interface SearchConfig {
	provider: SearchProviderId;
	defaultLimit: number;
	maxLimit?: number;
	/**
	 * Maximum `offset` — bounds the per-collection fetch window
	 * (`offset + limit`).
	 */
	maxOffset?: number;
}
