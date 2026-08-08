import { deleteWebhook } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const deleteWebhookSchema = z.object({
	id: z.string().min(1),
	organizationId: z.string().min(1),
});

export const deleteWebhookProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "DELETE",
		path: "/webhooks/{id}",
		tags: ["Webhooks"],
		summary: "Delete webhook",
		description: "Permanently deletes a webhook endpoint.",
	})
	.input(deleteWebhookSchema)
	.handler(async ({ input, context }) => {
		await requireOrgRole(
			input.organizationId,
			context.user.id,
			"admin",
			context.headers,
		);
		const result = await deleteWebhook(input.id, input.organizationId);
		if (!result) {
			throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
		}
		return { success: true };
	});
