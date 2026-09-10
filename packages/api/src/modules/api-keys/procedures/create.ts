import { countApiKeys, countOrgApiKeys, createApiKey } from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";

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
		const result = await createApiKey(
			context.user.id,
			input.name,
			input.organizationId ?? null,
			input.expiresAt ?? null,
		);
		return result;
	});
