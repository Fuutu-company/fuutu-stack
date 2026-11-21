import { desktopOAuth } from "@fuutu/auth/desktop-oauth";
import { revokeDesktopDevice } from "@fuutu/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";

/**
 * Signs one install out (its refresh token stops working; an issued access
 * token lives until it expires, at most 1 h). Browser session only —
 * device management stays in the web app, never with an app token.
 */
export const revokeDesktopDeviceProcedure = authProcedure({
	denyImpersonation: true,
	sessionOnly: true,
})
	.use(createRateLimitMiddleware({ maxRequests: 20, windowMs: 60_000 }))
	.route({
		method: "POST",
		path: "/desktop/devices/revoke",
		tags: ["Desktop"],
		summary: "Sign out a desktop device",
		description:
			"Revokes one signed-in desktop app install of the current user.",
	})
	.input(z.object({ deviceId: z.string().min(1) }))
	.output(z.object({ revoked: z.literal(true) }))
	.handler(async ({ input, context }) => {
		const revoked = await revokeDesktopDevice(
			context.user.id,
			desktopOAuth.clientId,
			input.deviceId,
		);
		if (!revoked) throw new ORPCError("NOT_FOUND", { message: "Not found" });
		return { revoked: true as const };
	});
