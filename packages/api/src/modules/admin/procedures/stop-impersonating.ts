import { auth } from "@fuutu/auth";
import { authConfig } from "@fuutu/auth/config";
import { createLogger } from "@fuutu/logs";
import { ORPCError } from "@orpc/server";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { protectedProcedure } from "../../../orpc/procedures";
import { recordAdminAction } from "../audit";
import {
	forwardSetCookies,
	requireResponseHeaders,
	withAuthErrors,
} from "../shared";

const log = createLogger({ scope: "admin:impersonation" });

/**
 * Ends an impersonation and restores the admin's own session. Called by
 * the impersonation session — the signed-in user is the target, so this
 * is deliberately not a system-admin procedure. When the admin session
 * cannot be restored (its cookie or row is gone), the impersonation is
 * signed out instead: `outcome: "signed_out"` with `redirectTo`
 * (`authConfig.redirects.afterSignOut`).
 */
export const stopImpersonatingProcedure = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "adminMutation" }))
	.route({
		method: "POST",
		path: "/admin/impersonation/stop",
		tags: ["Admin"],
		summary: "Stop impersonating",
		description:
			'Ends the current impersonation session and restores the admin\'s session (cookies in the response). `outcome: "signed_out"` when the admin session could not be restored — the impersonation is signed out anyway.',
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

		const restored = await withAuthErrors(() =>
			auth.api.stopImpersonating({
				headers: context.headers,
				returnHeaders: true,
			}),
		).catch((err: unknown) => {
			log.warn("admin session not restored — signing the impersonation out", {
				err: err instanceof Error ? err.message : String(err),
			});
			return null;
		});
		if (!restored) {
			// Deletes the impersonation session row and clears its cookies.
			const { headers } = await auth.api.signOut({
				headers: context.headers,
				returnHeaders: true,
			});
			forwardSetCookies(headers, resHeaders);
			await recordAdminAction(context, {
				action: "admin.user.impersonate_stop",
				actorUserId: impersonatedBy,
				targetUserId: context.user.id,
				outcome: "signed_out",
			});
			return {
				success: true,
				outcome: "signed_out" as const,
				redirectTo: authConfig.redirects.afterSignOut,
			};
		}
		forwardSetCookies(restored.headers, resHeaders);

		await recordAdminAction(context, {
			action: "admin.user.impersonate_stop",
			actorUserId: impersonatedBy,
			targetUserId: context.user.id,
		});
		return { success: true, outcome: "restored" as const };
	});
