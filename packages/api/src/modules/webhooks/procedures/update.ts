import { updateWebhook } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const updateWebhookSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
	url: z.string().url().optional(),
	events: z.array(z.string().min(1)).min(1).optional(),
	isActive: z.boolean().optional(),
});

export const updateWebhookProcedure = permissionProcedure("update:webhook")
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "PATCH",
		path: "/webhooks/{id}",
		tags: ["Webhooks"],
		summary: "Update webhook",
		description: "Updates a webhook endpoint's URL, events, or active status.",
	})
	.input(updateWebhookSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"admin",
			context.headers,
		);
		const result = await updateWebhook(input.id, input.organizationId, {
			...(input.url ? { url: input.url } : {}),
			...(input.events ? { events: input.events } : {}),
			...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
		});
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
		}
		return { success: true };
	});
