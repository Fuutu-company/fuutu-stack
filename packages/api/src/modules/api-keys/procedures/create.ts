import {
	countApiKeys,
	countOrgApiKeys,
	createApiKeyWithinLimit,
} from "@fuutu/db";
import { getPlanLimit } from "@fuutu/payments";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";

const createApiKeySchema = z.object({
	name: z.string().min(1).max(100),
	organizationId: z.string().optional(),
	expiresAt: z.coerce.date().optional(),
});

export const createApiKeyProcedure = authProcedure({
	systemPermission: PERMISSIONS.API_KEY.CREATE,
	org: {
		permission: PERMISSIONS.API_KEY.CREATE,
		optional: true,
	},
	limit: {
		key: "apiKeys",
		count: async (ctx) =>
			ctx.org ? countOrgApiKeys(ctx.org.id) : countApiKeys(ctx.user.id),
	},
})
	.use(createRateLimitMiddleware({ endpoint: "apiKeyMutation" }))
	.route({
		method: "POST",
		path: "/api-keys",
		tags: ["API Keys"],
		summary: "Create API key",
		description:
			"Creates a new API key. The plaintext key is returned only once.",
	})
	.input(createApiKeySchema)
	.handler(async ({ input, context }) => {
		// Race-safe re-check: the `limit` option above is a friendly
		// pre-flight — the count+insert inside createApiKeyWithinLimit runs
		// in a Serializable transaction so concurrent creates cannot both pass.
		const limitValue = getPlanLimit(context.planId ?? "free", "apiKeys");
		// `false` (feature not available on plan) must not collapse to
		// unlimited — map it to a zero cap so the create always refuses.
		const max =
			limitValue === false ? 0 : limitValue === "unlimited" ? null : limitValue;
		const result = await createApiKeyWithinLimit({
			userId: context.user.id,
			name: input.name,
			organizationId: input.organizationId ?? null,
			expiresAt: input.expiresAt ?? null,
			max,
		});
		if (!result) {
			throw new ORPCError("FORBIDDEN", { message: "Limit exceeded" });
		}
		return result;
	});
