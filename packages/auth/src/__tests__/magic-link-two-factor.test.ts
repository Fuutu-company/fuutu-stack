import { describe, expect, it, vi } from "vitest";
import { blockMagicLinkSecondFactorBypass } from "../hooks/magic-link-two-factor";

const ERROR_PAGE = "http://localhost:3000/auth/error";

const sessionFor = (twoFactorEnabled: boolean | null) => ({
	session: { token: "tok-1" },
	user: { twoFactorEnabled },
});

describe("blockMagicLinkSecondFactorBypass", () => {
	it("ends the session of a 2FA user and sends them to the error page", async () => {
		const endSession = vi.fn(async () => {});
		const url = await blockMagicLinkSecondFactorBypass({
			path: "/magic-link/verify",
			newSession: sessionFor(true),
			endSession,
			errorPageUrl: () => ERROR_PAGE,
		});
		expect(endSession).toHaveBeenCalledWith("tok-1");
		expect(url).toBe(`${ERROR_PAGE}?error=TWO_FACTOR_REQUIRED`);
	});

	it.each([false, null])(
		"keeps the session when 2FA is %s",
		async (twoFactorEnabled) => {
			const endSession = vi.fn(async () => {});
			const url = await blockMagicLinkSecondFactorBypass({
				path: "/magic-link/verify",
				newSession: sessionFor(twoFactorEnabled),
				endSession,
				errorPageUrl: () => ERROR_PAGE,
			});
			expect(url).toBeNull();
			expect(endSession).not.toHaveBeenCalled();
		},
	);

	it("ignores other paths (the 2FA plugin handles password sign-in)", async () => {
		const endSession = vi.fn(async () => {});
		const url = await blockMagicLinkSecondFactorBypass({
			path: "/sign-in/email",
			newSession: sessionFor(true),
			endSession,
			errorPageUrl: () => ERROR_PAGE,
		});
		expect(url).toBeNull();
		expect(endSession).not.toHaveBeenCalled();
	});

	it("does nothing when the link created no session (invalid token)", async () => {
		const endSession = vi.fn(async () => {});
		const url = await blockMagicLinkSecondFactorBypass({
			path: "/magic-link/verify",
			newSession: null,
			endSession,
			errorPageUrl: () => ERROR_PAGE,
		});
		expect(url).toBeNull();
		expect(endSession).not.toHaveBeenCalled();
	});
});
