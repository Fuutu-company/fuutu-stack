import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertInvitationForSignup } from "../hooks/invitation-only";

vi.mock("@fuutu/db", () => ({
	findPendingInvitation: vi.fn(async (email: string) =>
		email === "invited@b.dev" ? { id: "inv_1", email } : null,
	),
}));

describe("assertInvitationForSignup()", () => {
	it("no-ops when invitationOnly is off", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "a@b.dev" },
				{ path: "/sign-up/email" },
				false,
			),
		).resolves.toBeUndefined();
	});

	it("allows self-service sign-up with a pending invitation", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "invited@b.dev" },
				{ path: "/sign-up/email" },
				true,
			),
		).resolves.toBeUndefined();
	});

	it("rejects self-service sign-up without an invitation", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "a@b.dev" },
				{ path: "/sign-up/email" },
				true,
			),
		).rejects.toThrow(APIError);
	});

	it("rejects social-callback sign-up without an invitation", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "a@b.dev" },
				{ path: "/callback/google" },
				true,
			),
		).rejects.toThrow(APIError);
	});

	it("does not gate admin provisioning (/admin/create-user)", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "a@b.dev" },
				{ path: "/admin/create-user" },
				true,
			),
		).resolves.toBeUndefined();
	});

	it("does not gate context-free creation (seed/CLI)", async () => {
		await expect(
			assertInvitationForSignup({ email: "a@b.dev" }, null, true),
		).resolves.toBeUndefined();
	});
});
