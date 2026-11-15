import { describe, expect, expectTypeOf, it } from "vitest";
import { authClient } from "../client";

/**
 * The admin plugin's client half stays registered: it types the admin
 * fields of the session (`user.role`, `user.banned`, `session.impersonatedBy`)
 * and `authClient.admin.*`. Whether those endpoints answer is the server's
 * call (`authConfig.admin.exposeAuthEndpoints`, `disabledPaths`).
 */
describe("authClient admin plugin", () => {
	it("types the admin fields of the session", () => {
		type Session = typeof authClient.$Infer.Session;
		expectTypeOf<Session["user"]>().toHaveProperty("role");
		expectTypeOf<Session["user"]>().toHaveProperty("banned");
		expectTypeOf<Session["user"]>().toHaveProperty("banExpires");
		expectTypeOf<Session["session"]>().toHaveProperty("impersonatedBy");
		expectTypeOf<typeof authClient.$ERROR_CODES>().toHaveProperty(
			"YOU_CANNOT_BAN_YOURSELF",
		);
	});

	it("offers the admin actions", () => {
		expect(
			authClient.admin.checkRolePermission({
				role: "admin",
				permissions: { user: ["ban"] },
			}),
		).toBe(true);
	});
});
