import { auth } from "@fuutu/auth";
import { ORPCError } from "@orpc/server";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";
import { recordAdminAction } from "../audit";
import {
	forwardSetCookies,
	requireResponseHeaders,
	withAuthErrors,
} from "../shared";

/**
 * Ends an impersonation and restores the admin's own session. Called by
 * the impersonation session — the signed-in user is the target, so this
 * is deliberately not a system-admin procedure.
 */
export const stopImpersonatingProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/impersonation/stop",
		tags: ["Admin"],
		summary: "Stop impersonating",
		description:
			"Ends the current impersonation session and restores the admin's session (cookies in the response).",
	})
	.handler(async ({ context }) => {
		if (context.apiKey) {
			throw new ORPCError("FORBIDDEN", {
				message: "API keys cannot stop an impersonation",
			});
		}
		// Admin-plugin field — not on Better Auth's inferred session type.
		const impersonatedBy = (
			context.session?.session as { impersonatedBy?: string | null } | undefined
		)?.impersonatedBy;
		if (!impersonatedBy) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This session is not impersonating a user",
			});
		}
		const resHeaders = requireResponseHeaders(context);

		const { headers } = await withAuthErrors(() =>
			auth.api.stopImpersonating({
				headers: context.headers,
				returnHeaders: true,
			}),
		);
		forwardSetCookies(headers, resHeaders);

		await recordAdminAction(context, {
			action: "admin.user.impersonate_stop",
			actorUserId: impersonatedBy,
			targetUserId: context.user.id,
		});
		return { success: true };
	});
