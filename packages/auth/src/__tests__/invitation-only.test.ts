import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertInvitationForSignup } from "../hooks/invitation-only";

vi.mock("@fuutu/db", () => ({
	findPendingInvitation: vi.fn(async (email: string) =>
		email === "invited@b.dev" ? { id: "inv_1" } : null,
	),
	// Mirrors the Prisma `mode: "insensitive"` match in the real query.
	findPendingInvitationById: vi.fn(async (id: string, email: string) =>
		id === "inv_1" && email.toLowerCase() === "invited@b.dev" ? { id } : null,
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

	it("allows /sign-up/email when the invite token matches the email", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "invited@b.dev" },
				{ path: "/sign-up/email", body: { invitationId: "inv_1" } },
				true,
			),
		).resolves.toBeUndefined();
	});

	it("allows /sign-up/email for a mixed-case invite email", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "Invited@B.dev" },
				{ path: "/sign-up/email", body: { invitationId: "inv_1" } },
				true,
			),
		).resolves.toBeUndefined();
	});

	it("rejects /sign-up/email without an invite token", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "invited@b.dev" },
				{ path: "/sign-up/email" },
				true,
			),
		).rejects.toThrow(APIError);
	});

	it("rejects /sign-up/email when the token belongs to another email", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "other@b.dev" },
				{ path: "/sign-up/email", body: { invitationId: "inv_1" } },
				true,
			),
		).rejects.toThrow(APIError);
	});

	it("rejects /sign-up/email when the invite token is not a string", async () => {
		for (const invitationId of [42, ["inv_1"], { id: "inv_1" }]) {
			await expect(
				assertInvitationForSignup(
					{ email: "invited@b.dev" },
					{ path: "/sign-up/email", body: { invitationId } },
					true,
				),
			).rejects.toThrow(APIError);
		}
	});

	it("rejects /sign-up/email with an unknown invite token", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "invited@b.dev" },
				{ path: "/sign-up/email", body: { invitationId: "inv_999" } },
				true,
			),
		).rejects.toThrow(APIError);
	});

	it("allows magic-link auto-sign-up with a pending invitation", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: "invited@b.dev" },
				{ path: "/magic-link/verify" },
				true,
			),
		).resolves.toBeUndefined();
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

	it("rejects self-service sign-up without an email", async () => {
		await expect(
			assertInvitationForSignup(
				{ email: null },
				{ path: "/callback/google" },
				true,
			),
		).rejects.toThrow(APIError);
	});
});
