import { deleteWebhook } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const deleteWebhookSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const deleteWebhookProcedure = authProcedure({
	org: { permission: PERMISSIONS.WEBHOOK.DELETE },
})
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "DELETE",
		path: "/webhooks/{id}",
		tags: ["Webhooks"],
		summary: "Delete webhook",
		description: "Permanently deletes a webhook endpoint.",
	})
	.input(deleteWebhookSchema)
	.handler(async ({ input }) => {
		const result = await deleteWebhook(input.id, input.organizationId);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
		}
		return { success: true };
	});
