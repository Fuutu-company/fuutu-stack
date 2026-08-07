import { countAuditLogs, listAuditLogs } from "@fuutu/db";
import { z } from "zod";
import { adminProcedure } from "../../../orpc";

/**
 * Current filter is admin-global. Before adding org-scoped audit events,
 * add an `organizationId` column + migration and accept an
 * `organizationId` input here to scope the query for non-owner roles.
 */
const listAuditLogsInput = z.object({
	userId: z.string().uuid().optional(),
	action: z.string().min(1).max(100).optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(200).default(50),
});

export const listAuditLogsProcedure = adminProcedure
	.route({
		method: "GET",
		path: "/admin/audit-logs",
		tags: ["Admin"],
		summary: "List audit logs",
		description:
			"Paginated audit-log feed. Filter by `userId` and/or `action`. Admin-only.",
	})
	.input(listAuditLogsInput)
	.handler(async ({ input }) => {
		const { userId, action, page, pageSize } = input;
		const skip = (page - 1) * pageSize;

		const [items, total] = await Promise.all([
			listAuditLogs({ userId, action, take: pageSize, skip }),
			countAuditLogs({ userId, action }),
		]);

		return {
			items,
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		};
	});
