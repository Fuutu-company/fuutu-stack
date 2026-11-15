import { countAuditLogs, listAuditLogs } from "@fuutu/db";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { adminProcedure } from "../../../orpc/procedures";
import { adminIdSchema, pageSchema } from "../shared";

/**
 * Admin-global audit feed. Support actions (`admin.*`) carry the acting
 * admin in `userId` and their targets in metadata — `timelineUserId` /
 * `timelineOrganizationId` combine both for a detail page.
 */
const listAuditLogsInput = z.object({
	userId: adminIdSchema.optional(),
	actorUserId: adminIdSchema.optional(),
	organizationId: adminIdSchema.optional(),
	targetUserId: adminIdSchema.optional(),
	targetOrganizationId: adminIdSchema.optional(),
	timelineUserId: adminIdSchema.optional(),
	timelineOrganizationId: adminIdSchema.optional(),
	action: z.string().min(1).max(100).optional(),
	actionPrefix: z.string().min(1).max(100).optional(),
	from: z.coerce.date().optional(),
	to: z.coerce.date().optional(),
	page: pageSchema,
	pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const listAuditLogsProcedure = adminProcedure
	.use(createRateLimitMiddleware({ endpoint: "adminRead" }))
	.route({
		method: "GET",
		path: "/admin/audit-logs",
		tags: ["Admin"],
		summary: "List audit logs",
		description:
			"Paginated audit-log feed. Filter by user, actor, organization, target, action (exact or prefix) and date range. Admin-only.",
	})
	.input(listAuditLogsInput)
	.handler(async ({ input }) => {
		const { page, pageSize, ...filters } = input;
		const skip = (page - 1) * pageSize;

		const [items, total] = await Promise.all([
			listAuditLogs({ ...filters, take: pageSize, skip }),
			countAuditLogs(filters),
		]);

		return {
			items,
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		};
	});
