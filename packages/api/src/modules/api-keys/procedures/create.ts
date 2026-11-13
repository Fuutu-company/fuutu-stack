import {
	countApiKeys,
	countOrgApiKeys,
	createApiKeyWithinLimit,
} from "@fuutu/db";
import { PERMISSIONS } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { apiConfig } from "../../../config";
import { entitledLimit } from "../../../orpc/middleware/authorize";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { assertSessionCaller } from "../assert-session-caller";

const createApiKeySchema = z.object({
	name: z.string().min(1).max(100),
	organizationId: z.string().optional(),
	// Only org keys accept scopes; omitted/empty = unrestricted org credential.
	scopes: z.array(z.enum(apiConfig.apiKeyScopes)).max(10).optional(),
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
		assertSessionCaller(context);
		if (input.scopes?.length) {
			// Scopes are an org-key concept: requireApiKey only admits keys
			// with an organizationId, so a scoped personal key could never
			// satisfy the guard — reject instead of silently storing them.
			if (!input.organizationId) {
				throw new ORPCError("BAD_REQUEST", {
					message: "Scopes are only supported on organization API keys",
				});
			}
			const needsSystemAdmin = input.scopes.some((scope) =>
				apiConfig.apiKeyAdminScopes.includes(scope),
			);
			if (needsSystemAdmin && context.systemRole !== "admin") {
				throw new ORPCError("FORBIDDEN", {
					message: "Only system admins can grant this scope",
				});
			}
		}
		const scopes = input.scopes ? [...new Set(input.scopes)] : undefined;
		// Race-safe re-check: the `limit` option above is a friendly
		// pre-flight — the count+insert inside createApiKeyWithinLimit runs
		// in a Serializable transaction so concurrent creates cannot both pass.
		const limitValue = entitledLimit(context, "apiKeys");
		// `false` (feature not available on plan) must not collapse to
		// unlimited — map it to a zero cap so the create always refuses.
		const max =
			limitValue === false ? 0 : limitValue === "unlimited" ? null : limitValue;
		const result = await createApiKeyWithinLimit({
			userId: context.user.id,
			name: input.name,
			organizationId: input.organizationId ?? null,
			expiresAt: input.expiresAt ?? null,
			...(scopes ? { scopes } : {}),
			max,
		});
		if (!result) {
			throw new ORPCError("FORBIDDEN", { message: "Limit exceeded" });
		}
		return result;
	});
