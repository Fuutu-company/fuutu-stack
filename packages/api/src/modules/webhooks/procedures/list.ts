import { countWebhooks, listWebhooks } from "@fuutu/db";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const listWebhooksSchema = z.object({
	organizationId: z.string().min(1),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listWebhooksProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/webhooks",
		tags: ["Webhooks"],
		summary: "List webhooks",
		description: "Returns paginated webhooks for an organization.",
	})
	.input(listWebhooksSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"member",
			context.headers,
		);
		const skip = (input.page - 1) * input.limit;
		const [items, total] = await Promise.all([
			listWebhooks(input.organizationId, {
				take: input.limit,
				skip,
			}),
			countWebhooks(input.organizationId),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
