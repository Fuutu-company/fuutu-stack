import { countWebhooks, createWebhookWithinLimit } from "@fuutu/db";
import { getPlanLimit } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { validateWebhookUrl } from "@fuutu/webhooks";
import { WEBHOOK_EVENTS } from "@fuutu/webhooks/events";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";

const createWebhookSchema = z.object({
	organizationId: z.string().min(1),
	url: z.string().url(),
	events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
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
	.handler(async ({ input, context }) => {
		const validation = await validateWebhookUrl(input.url);
		if (!validation.valid) {
			throw new ORPCError("BAD_REQUEST", { message: "Invalid webhook URL" });
		}
		// Race-safe re-check: the `limit` option above is a friendly
		// pre-flight — count+insert run in a Serializable transaction.
		const limitValue = getPlanLimit(context.planId ?? "free", "webhooks");
		const max =
			limitValue === false ? 0 : limitValue === "unlimited" ? null : limitValue;
		const result = await createWebhookWithinLimit({
			organizationId: input.organizationId,
			url: input.url,
			events: input.events,
			max,
		});
		if (!result) {
			throw new ORPCError("FORBIDDEN", { message: "Limit exceeded" });
		}
		return result;
	});
