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
 *
 * Tenant scoping is enforced: `notifications` requires `query.userId`,
 * `audit-logs` requires `query.userId` or `query.organizationId`. A query
 * without a scope that would touch those collections throws instead of
 * leaking cross-tenant rows.
 */
export const postgresProvider: SearchProvider = {
	id: "postgres",

	async search(query: SearchQuery): Promise<SearchResult[]> {
		const limit = query.limit ?? searchConfig.defaultLimit;
		const offset = query.offset ?? 0;
		const results: SearchResult[] = [];

		const typeFilter =
			typeof query.filters?.type === "string" ? query.filters.type : undefined;
		const actionFilter =
			typeof query.filters?.action === "string"
				? query.filters.action
				: undefined;

		const wantsNotifications =
			!query.collection || query.collection === "notifications";
		const wantsAuditLogs =
			!query.collection || query.collection === "audit-logs";

		if (wantsNotifications) {
			if (!query.userId) {
				throw new Error(
					"SearchQuery requires a userId scope to search notifications",
				);
			}
			const notifications = await searchNotifications(
				query.text,
				{ userId: query.userId },
				{ take: limit, skip: offset, type: typeFilter },
			);
			const needle = query.text.toLowerCase();
			for (const n of notifications) {
				results.push({
					id: n.id,
					collection: "notifications",
					title: n.title,
					snippet: n.body.slice(0, 200),
					// LIKE has no relevance ranking — a title match outranks a
					// body-only match.
					score: n.title.toLowerCase().includes(needle) ? 1 : 0.5,
				});
			}
		}

		if (wantsAuditLogs) {
			const scope = query.userId
				? { userId: query.userId }
				: query.organizationId
					? { organizationId: query.organizationId }
					: undefined;
			if (!scope) {
				throw new Error(
					"SearchQuery requires a userId or organizationId scope to search audit-logs",
				);
			}
			const logs = await searchAuditLogs(query.text, scope, {
				take: limit,
				skip: offset,
				action: actionFilter,
			});
			for (const log of logs) {
				results.push({
					id: log.id,
					collection: "audit-logs",
					title: log.action,
					snippet:
						log.metadata === null || log.metadata === undefined
							? log.action
							: JSON.stringify(log.metadata).slice(0, 200),
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
