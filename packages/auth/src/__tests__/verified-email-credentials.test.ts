import { describe, expect, it, vi } from "vitest";
import { assertVerifiedEmailForCredential } from "../hooks/verified-email-credentials";

const sessionWith = (emailVerified: boolean | null) => async () => ({
	user: { emailVerified },
});

const CREDENTIAL_PATHS = [
	"/passkey/generate-register-options",
	"/passkey/verify-registration",
	"/two-factor/enable",
];

describe("assertVerifiedEmailForCredential", () => {
	it.each(
		CREDENTIAL_PATHS.flatMap((path) => [
			[path, false],
			[path, null],
		]),
	)(
		"refuses %s while the email is unverified (%s)",
		async (path, emailVerified) => {
			await expect(
				assertVerifiedEmailForCredential({
					path: path as string,
					getSession: sessionWith(emailVerified as boolean | null),
				}),
			).rejects.toMatchObject({
				statusCode: 403,
				body: { code: "EMAIL_NOT_VERIFIED" },
			});
		},
	);

	it.each(CREDENTIAL_PATHS)("allows %s for a verified email", async (path) => {
		await expect(
			assertVerifiedEmailForCredential({
				path,
				getSession: sessionWith(true),
			}),
		).resolves.toBeUndefined();
	});

	it("leaves a missing session to the endpoint (401 there)", async () => {
		await expect(
			assertVerifiedEmailForCredential({
				path: "/two-factor/enable",
				getSession: async () => null,
			}),
		).resolves.toBeUndefined();
	});

	it.each([
		"/passkey/verify-authentication", // signing in, not registering
		"/two-factor/disable",
		"/two-factor/verify-totp",
		"/update-user",
	])("never reads the session on %s", async (path) => {
		const getSession = vi.fn(sessionWith(false));
		await assertVerifiedEmailForCredential({ path, getSession });
		expect(getSession).not.toHaveBeenCalled();
	});
});
