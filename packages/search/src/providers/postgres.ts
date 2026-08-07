import { searchAuditLogs, searchNotifications } from "@fuutu/db";
import { searchConfig } from "../config";
import type {
	SearchDocument,
	SearchProvider,
	SearchQuery,
	SearchResult,
} from "../types";

/**
 * Postgres search provider — uses LIKE queries via @fuutu/db.
 *
 * v1: searches the `notification` and `audit_log` tables by title/action
 * and body/metadata. tsvector support can be added later without changing
 * the interface.
 */
export const postgresProvider: SearchProvider = {
	id: "postgres",

	async search(query: SearchQuery): Promise<SearchResult[]> {
		const limit = query.limit ?? searchConfig.defaultLimit;
		const offset = query.offset ?? 0;
		const results: SearchResult[] = [];

		if (!query.collection || query.collection === "notifications") {
			const notifications = await searchNotifications(query.text, {
				take: limit,
				skip: offset,
			});
			for (const n of notifications) {
				results.push({
					id: n.id,
					collection: "notifications",
					title: n.title,
					snippet: n.body.slice(0, 200),
					score: 1,
				});
			}
		}

		if (!query.collection || query.collection === "audit-logs") {
			const logs = await searchAuditLogs(query.text, {
				take: limit,
				skip: offset,
			});
			for (const log of logs) {
				results.push({
					id: log.id,
					collection: "audit-logs",
					title: log.action,
					snippet: log.action,
					score: 1,
				});
			}
		}

		return results.slice(0, limit);
	},

	async index(
		_collection: string,
		_documents: SearchDocument[],
	): Promise<void> {
		// Postgres stores data in its own tables — indexing is handled by
		// the schema. This is a no-op for the Postgres provider.
	},
};
