import { describe, expect, it, vi } from "vitest";
import {
	assertSecondFactorForNewAccountLink,
	assertSecondFactorForNewSession,
	TWO_FACTOR_REQUIRED,
} from "../hooks/second-factor-session";

const ERROR_PAGE = "http://localhost:3000/auth/error";

class Redirect extends Error {
	constructor(readonly url: string) {
		super("redirect");
	}
}

const run = (path: string | undefined, twoFactorEnabled: boolean | null) => {
	const findUser = vi.fn(async () => ({ twoFactorEnabled }));
	const promise = assertSecondFactorForNewSession({
		path,
		userId: "user-1",
		findUser,
		errorPageUrl: () => ERROR_PAGE,
		redirect: (url) => new Redirect(url),
	});
	return { promise, findUser };
};

describe("assertSecondFactorForNewSession", () => {
	it.each(["/magic-link/verify", "/callback/:id"])(
		"refuses a session from %s for a 2FA user and redirects to the error page",
		async (path) => {
			const { promise, findUser } = run(path, true);
			await expect(promise).rejects.toMatchObject({
				url: `${ERROR_PAGE}?error=${TWO_FACTOR_REQUIRED}`,
			});
			expect(findUser).toHaveBeenCalledWith("user-1");
		},
	);

	it("refuses a session from /sign-in/social (id token) with an API error", async () => {
		const { promise } = run("/sign-in/social", true);
		await expect(promise).rejects.toMatchObject({
			statusCode: 403,
			body: { code: TWO_FACTOR_REQUIRED },
		});
	});

	it.each([false, null])(
		"allows the session when 2FA is %s",
		async (twoFactorEnabled) => {
			await expect(
				run("/magic-link/verify", twoFactorEnabled).promise,
			).resolves.toBeUndefined();
		},
	);

	it.each([
		"/sign-in/email", // the 2FA plugin challenges password sign-ins
		"/two-factor/verify-totp",
		"/passkey/verify-authentication", // passkey counts as the second factor
		undefined, // server-side createSession without an endpoint
	])("leaves %s alone without a user lookup", async (path) => {
		const { promise, findUser } = run(path, true);
		await expect(promise).resolves.toBeUndefined();
		expect(findUser).not.toHaveBeenCalled();
	});
});

describe("assertSecondFactorForNewAccountLink", () => {
	const link = (
		path: string | undefined,
		twoFactorEnabled: boolean,
		isLinkFlow = false,
	) => {
		const findUser = vi.fn(async () => ({ twoFactorEnabled }));
		const promise = assertSecondFactorForNewAccountLink({
			path,
			userId: "user-1",
			isLinkFlow: async () => isLinkFlow,
			findUser,
			errorPageUrl: () => ERROR_PAGE,
			redirect: (url) => new Redirect(url),
		});
		return { promise, findUser };
	};

	it("refuses linking a new provider account to a 2FA user on the OAuth callback", async () => {
		// The refused session alone would leave the attacker's provider
		// account linked — usable once the victim turns 2FA off.
		await expect(link("/callback/:id", true).promise).rejects.toMatchObject({
			url: `${ERROR_PAGE}?error=${TWO_FACTOR_REQUIRED}`,
		});
	});

	it("refuses it on /sign-in/social (id token) with an API error", async () => {
		await expect(link("/sign-in/social", true).promise).rejects.toMatchObject({
			statusCode: 403,
			body: { code: TWO_FACTOR_REQUIRED },
		});
	});

	it("allows the authenticated link flow (/link-social → callback)", async () => {
		const { promise, findUser } = link("/callback/:id", true, true);
		await expect(promise).resolves.toBeUndefined();
		expect(findUser).not.toHaveBeenCalled();
	});

	it("allows a link for a user without 2FA (accountLinking rules apply)", async () => {
		await expect(link("/callback/:id", false).promise).resolves.toBeUndefined();
	});

	it("leaves /link-social (id token, signed in) alone", async () => {
		const { promise, findUser } = link("/link-social", true);
		await expect(promise).resolves.toBeUndefined();
		expect(findUser).not.toHaveBeenCalled();
	});
});
