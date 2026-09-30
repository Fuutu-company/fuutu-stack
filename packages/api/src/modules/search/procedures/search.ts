import { PERMISSIONS } from "@fuutu/rbac";
import { resolveSearchProvider } from "@fuutu/search";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const searchSchema = z.object({
	text: z.string().min(1).max(200),
	collection: z.enum(["notifications", "audit-logs"]).optional(),
	// Org ids are provider-generated (Better Auth ids are not UUIDs), so
	// accept any non-empty string — the org access check enforces validity.
	organizationId: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(50).optional(),
	offset: z.number().int().min(0).optional(),
});

/**
 * Full-text search across the collections the active provider indexes.
 *
 * Tenant scope is derived server-side — callers can never widen it:
 *   - no `organizationId` → user scope (own notifications + audit logs)
 *   - `organizationId` set → requires AUDIT_LOG.VIEW on that org and the
 *     search is pinned to the org's audit logs (notifications are
 *     user-owned, never org-readable).
 */
export const searchProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "search" }))
	.route({
		method: "POST",
		path: "/search",
		tags: ["Search"],
		summary: "Full-text search",
		description:
			"Searches notifications and audit logs. Results are always scoped to the caller — pass organizationId to search an org's audit log (requires org admin).",
	})
	.input(searchSchema)
	.handler(async ({ input, context }) => {
		const provider = resolveSearchProvider();

		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.AUDIT_LOG.VIEW,
				context,
			);
			return provider.search({
				text: input.text,
				collection: "audit-logs",
				organizationId: input.organizationId,
				limit: input.limit,
				offset: input.offset,
			});
		}

		return provider.search({
			text: input.text,
			collection: input.collection,
			userId: context.user.id,
			limit: input.limit,
			offset: input.offset,
		});
	});
