import { countDeliveries, getWebhook, listDeliveries } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../../../orpc";
import { requireOrgRole } from "../../../organizations/shared";

const listDeliveriesSchema = z.object({
	webhookId: z.string().min(1),
	organizationId: z.string().min(1),
	page: z.number().int().min(1).default(1),
	limit: z.number().int().min(1).max(100).default(50),
});

export const listDeliveriesProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/webhooks/{webhookId}/deliveries",
		tags: ["Webhooks"],
		summary: "List webhook deliveries",
		description: "Returns paginated delivery attempts for a webhook.",
	})
	.input(listDeliveriesSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"member",
			context.headers,
		);
		const webhook = await getWebhook(input.webhookId, input.organizationId);
		if (!webhook) {
			throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
		}
		const skip = (input.page - 1) * input.limit;
		const [items, total] = await Promise.all([
			listDeliveries(input.webhookId, {
				take: input.limit,
				skip,
			}),
			countDeliveries(input.webhookId),
		]);
		return {
			items,
			page: input.page,
			limit: input.limit,
			total,
			totalPages: Math.max(1, Math.ceil(total / input.limit)),
		};
	});
