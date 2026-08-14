import {
	getCreditEventsForOrganization,
	getCreditEventsForUser,
} from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const historySchema = z.object({
	organizationId: z.string().uuid().optional(),
	meterKey: z.string().optional(),
	limit: z.number().int().min(1).max(100).default(50),
});

export const getHistory = protectedProcedure
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
		}
		const events = input.organizationId
			? await getCreditEventsForOrganization(input.organizationId, input.limit)
			: await getCreditEventsForUser(context.user.id, input.limit);
		return { events };
	});
