import { describe, expect, it, vi } from "vitest";
import { assertVerifiedEmailForChange } from "../hooks/verified-email-change";

const sessionWith = (emailVerified: boolean | null) => async () => ({
	user: { emailVerified },
});

describe("assertVerifiedEmailForChange", () => {
	it.each([false, null])(
		"refuses /change-email while the current email is unverified (%s)",
		async (emailVerified) => {
			await expect(
				assertVerifiedEmailForChange({
					path: "/change-email",
					getSession: sessionWith(emailVerified),
				}),
			).rejects.toMatchObject({
				statusCode: 403,
				body: { code: "EMAIL_NOT_VERIFIED" },
			});
		},
	);

	it("allows it for a verified email (confirmation goes to that address)", async () => {
		await expect(
			assertVerifiedEmailForChange({
				path: "/change-email",
				getSession: sessionWith(true),
			}),
		).resolves.toBeUndefined();
	});

	it("leaves a missing session to the endpoint (401 there)", async () => {
		await expect(
			assertVerifiedEmailForChange({
				path: "/change-email",
				getSession: async () => null,
			}),
		).resolves.toBeUndefined();
	});

	it("never reads the session on other paths", async () => {
		const getSession = vi.fn(sessionWith(false));
		await assertVerifiedEmailForChange({ path: "/update-user", getSession });
		expect(getSession).not.toHaveBeenCalled();
	});
});
