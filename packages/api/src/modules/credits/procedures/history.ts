import {
	getCreditEventsForMeter,
	getCreditEventsForOrganization,
	getCreditEventsForUser,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";

import { z } from "zod";
import { requireOrgPermissionAccess } from "../../../orpc/org-access";
import { permissionProcedure } from "../../../orpc/procedures";

const historySchema = z.object({
	organizationId: z.string().min(1).optional(),
	meterKey: z.string().min(1).max(100).optional(),
	limit: z.number().int().min(1).max(100).default(50),
});

export const getHistory = permissionProcedure(PERMISSIONS.CREDIT.VIEW)
	.route({
		method: "GET",
		path: "/credits/history",
		tags: ["Credits"],
		summary: "Get credit event history",
		description: "Returns the audit trail of credit consumption events.",
	})
	.input(historySchema)
	.handler(async ({ input, context }) => {
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.CREDIT.VIEW,
				context,
			);
		}
		const events = input.meterKey
			? await getCreditEventsForMeter({
					userId: input.organizationId ? undefined : context.user.id,
					organizationId: input.organizationId,
					meterKey: input.meterKey,
					limit: input.limit,
				})
			: input.organizationId
				? await getCreditEventsForOrganization(
						input.organizationId,
						input.limit,
					)
				: await getCreditEventsForUser(context.user.id, input.limit);
		return { events };
	});
