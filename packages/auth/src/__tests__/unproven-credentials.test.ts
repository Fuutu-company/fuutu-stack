import { describe, expect, it, vi } from "vitest";
import {
	markMailboxProof,
	revokeUnprovenCredentials,
} from "../hooks/unproven-credentials";

const deps = () => ({
	deletePasskeys: vi.fn(async () => {}),
	deleteTwoFactor: vi.fn(async () => {}),
	revokeApiKeys: vi.fn(async () => {}),
	revokeOAuthTokens: vi.fn(async () => {}),
});

describe("credentials of an unverified account the mailbox owner takes over", () => {
	it.each(["/magic-link/verify", "/sign-in/email-otp"])(
		"are dropped when %s verifies the email",
		async (path) => {
			const ctx = { path };
			expect(
				markMailboxProof({ emailVerified: true }, ctx, { twoFactor: true }),
			).toEqual({ data: { emailVerified: true, twoFactorEnabled: false } });

			const d = deps();
			await revokeUnprovenCredentials({ id: "user-1" }, ctx, d);
			expect(d.deletePasskeys).toHaveBeenCalledWith("user-1");
			expect(d.deleteTwoFactor).toHaveBeenCalledWith("user-1");
			expect(d.revokeApiKeys).toHaveBeenCalledWith("user-1");
			expect(d.revokeOAuthTokens).toHaveBeenCalledWith("user-1");
		},
	);

	it("leaves twoFactorEnabled alone when the 2FA plugin is off", () => {
		expect(
			markMailboxProof(
				{ emailVerified: true },
				{ path: "/magic-link/verify" },
				{ twoFactor: false },
			),
		).toEqual({ data: { emailVerified: true } });
	});

	it.each([
		["/verify-email", { emailVerified: true }], // also the email-change path
		["/update-user", { emailVerified: true }],
		["/magic-link/verify", { name: "Ada" }],
		["/magic-link/verify", { emailVerified: false }],
	])("ignores %s with %o", async (path, data) => {
		const ctx = { path };
		expect(markMailboxProof(data, ctx, { twoFactor: true })).toBeUndefined();
		const d = deps();
		await revokeUnprovenCredentials({ id: "user-1" }, ctx, d);
		expect(d.deletePasskeys).not.toHaveBeenCalled();
		expect(d.revokeApiKeys).not.toHaveBeenCalled();
	});

	it("runs once per proof, not on later updates in the same request", async () => {
		const ctx = { path: "/magic-link/verify" };
		markMailboxProof({ emailVerified: true }, ctx, { twoFactor: true });
		await revokeUnprovenCredentials({ id: "user-1" }, ctx, deps());
		const later = deps();
		await revokeUnprovenCredentials({ id: "user-1" }, ctx, later);
		expect(later.deletePasskeys).not.toHaveBeenCalled();
	});

	it("does nothing without an endpoint context (server-side update)", async () => {
		expect(
			markMailboxProof({ emailVerified: true }, null, { twoFactor: true }),
		).toBeUndefined();
		const d = deps();
		await revokeUnprovenCredentials({ id: "user-1" }, null, d);
		expect(d.deletePasskeys).not.toHaveBeenCalled();
	});
});
