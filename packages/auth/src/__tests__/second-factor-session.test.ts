import { describe, expect, it, vi } from "vitest";
import {
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
