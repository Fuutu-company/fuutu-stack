import {
	type AuditLogSearchScope,
	searchAuditLogs,
	searchNotifications,
} from "@fuutu/db";
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
 * Tenant scoping is enforced: a query without `userId` or
 * `organizationId` throws instead of leaking cross-tenant rows.
 * `notifications` is user-owned (requires `userId`); `audit-logs`
 * accepts either scope.
 *
 * Pagination is global: each collection contributes its most recent
 * `offset + limit` hits and the merged window is score-sorted — deep
 * matches beyond that window are not ranked. `offset` is capped by
 * `searchConfig.maxOffset` to bound the per-collection fetch size.
 *
 * Org-scoped queries (`organizationId` without `userId`) that do not
 * name a collection silently exclude user-owned notifications; passing
 * `collection: "notifications"` explicitly throws instead.
 */
export const postgresProvider: SearchProvider = {
	id: "postgres",

	async search(query: SearchQuery): Promise<SearchResult[]> {
		// Fail-loud input validation — same convention as @fuutu/credits;
		// this package carries no zod dependency.
		if (typeof query.text !== "string" || query.text.trim().length === 0) {
			throw new Error("SearchQuery.text must be a non-empty string");
		}
		const text = query.text.trim();
		// `Math.max(1, …)` so a misconfigured `maxLimit: 0` can't shrink
		// the valid range below the `min 1` floor.
		const maxLimit = Math.max(1, searchConfig.maxLimit ?? 50);
		const limit = query.limit ?? searchConfig.defaultLimit;
		if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
			throw new Error(
				`SearchQuery.limit must be an integer between 1 and ${maxLimit}`,
			);
		}
		const maxOffset = searchConfig.maxOffset ?? 10_000;
		const offset = query.offset ?? 0;
		if (!Number.isInteger(offset) || offset < 0 || offset > maxOffset) {
			throw new Error(
				`SearchQuery.offset must be an integer between 0 and ${maxOffset}`,
			);
		}

		const typeFilter =
			typeof query.filters?.type === "string" ? query.filters.type : undefined;
		const actionFilter =
			typeof query.filters?.action === "string"
				? query.filters.action
				: undefined;

		// Nullish checks, not truthiness — `collection: ""` must fail both
		// flags so the unknown-collection throw below catches it instead
		// of silently searching all collections.
		const wantsNotifications =
			query.collection == null || query.collection === "notifications";
		const wantsAuditLogs =
			query.collection == null || query.collection === "audit-logs";
		if (query.collection != null && !wantsNotifications && !wantsAuditLogs) {
			throw new Error(
				`Unknown collection "${query.collection}" — postgres provider supports: notifications, audit-logs`,
			);
		}

		// Audit-log scope — also the early tenant-scope guard: a query
		// with neither id must never reach the db.
		const auditScope: AuditLogSearchScope | undefined = query.userId
			? { userId: query.userId }
			: query.organizationId
				? { organizationId: query.organizationId }
				: undefined;
		if (!auditScope) {
			throw new Error("SearchQuery requires a userId or organizationId scope");
		}

		const results: SearchResult[] = [];
		// Fetch `offset + limit` per collection and paginate the merged
		// result — per-collection skip would re-drop hits on later pages.
		const fetchSize = offset + limit;

		if (wantsNotifications) {
			if (query.userId) {
				const notifications = await searchNotifications(
					text,
					{ userId: query.userId },
					{ take: fetchSize, skip: 0, type: typeFilter },
				);
				const needle = text.toLowerCase();
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
			} else if (query.collection === "notifications") {
				// Org-scope caller explicitly asked for user-owned rows.
				throw new Error(
					"SearchQuery requires a userId scope to search notifications",
				);
			}
			// Otherwise an org-scope query silently skips notifications —
			// they are user-owned and never org-readable.
		}

		if (wantsAuditLogs) {
			const logs = await searchAuditLogs(text, auditScope, {
				take: fetchSize,
				skip: 0,
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

		// Stable sort keeps per-collection order within score ties.
		results.sort((a, b) => b.score - a.score);
		return results.slice(offset, offset + limit);
	},

	async index(
		_collection: string,
		_documents: SearchDocument[],
	): Promise<void> {
		// Postgres stores data in its own tables — indexing is handled by
		// the schema. This is a no-op for the Postgres provider.
	},
};
