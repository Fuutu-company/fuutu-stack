import {
	getCreditEventsForOrganization,
	getCreditEventsForUser,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";

import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const historySchema = z.object({
	organizationId: z.string().uuid().optional(),
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
				context.headers,
			);
		}
		const events = input.organizationId
			? await getCreditEventsForOrganization(input.organizationId, input.limit)
			: await getCreditEventsForUser(context.user.id, input.limit);
		return { events };
	});
