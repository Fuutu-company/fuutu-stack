import { createWebhook } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const createWebhookSchema = z.object({
	organizationId: z.string().min(1),
	url: z.string().url(),
	events: z.array(z.string().min(1)).min(1),
});

export const createWebhookProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "webhookMutation" }))
	.route({
		method: "POST",
		path: "/webhooks",
		tags: ["Webhooks"],
		summary: "Create webhook",
		description:
			"Creates a new webhook endpoint. The signing secret is returned only once.",
	})
	.input(createWebhookSchema)
	.handler(async ({ input, context }) => {
		await requireOrgPermissionAccess(
			input.organizationId,
			context.user.id,
			PERMISSIONS.WEBHOOK.CREATE,
			context.headers,
		);
		const result = await createWebhook(
			input.organizationId,
			input.url,
			input.events,
		);
		return result;
	});
