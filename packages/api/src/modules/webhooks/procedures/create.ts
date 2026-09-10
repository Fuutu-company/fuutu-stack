import { countWebhooks, createWebhook } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

const createWebhookSchema = z.object({
	organizationId: z.string().min(1),
	url: z.string().url(),
	events: z.array(z.string().min(1)).min(1),
});

export const createWebhookProcedure = authProcedure({
	org: { permission: PERMISSIONS.WEBHOOK.CREATE },
	plan: "pro",
	limit: {
		key: "webhooks",
		count: async (ctx) => countWebhooks(ctx.org?.id ?? ""),
	},
})
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "POST",
		path: "/webhooks",
		tags: ["Webhooks"],
		summary: "Create webhook",
		description:
			"Creates a new webhook endpoint. The signing secret is returned only once. Requires a Pro plan.",
	})
	.input(createWebhookSchema)
	.handler(async ({ input }) => {
		const result = await createWebhook(
			input.organizationId,
			input.url,
			input.events,
		);
		return result;
	});
