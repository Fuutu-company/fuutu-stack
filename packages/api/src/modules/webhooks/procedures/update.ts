import { updateWebhook } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { validateWebhookUrl } from "@fuutu/webhooks";
import { WEBHOOK_EVENTS } from "@fuutu/webhooks/events";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";

const updateWebhookSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
	url: z.string().url().optional(),
	events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
	isActive: z.boolean().optional(),
});

export const updateWebhookProcedure = authProcedure({
	org: { permission: PERMISSIONS.WEBHOOK.UPDATE },
})
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "PATCH",
		path: "/webhooks/{id}",
		tags: ["Webhooks"],
		summary: "Update webhook",
		description: "Updates a webhook endpoint's URL, events, or active status.",
	})
	.input(updateWebhookSchema)
	.handler(async ({ input }) => {
		if (input.url) {
			const validation = await validateWebhookUrl(input.url);
			if (!validation.valid) {
				throw new ORPCError("BAD_REQUEST", { message: "Invalid webhook URL" });
			}
		}
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
