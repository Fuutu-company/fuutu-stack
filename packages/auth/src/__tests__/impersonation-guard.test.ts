import { APIError } from "better-auth/api";
import { describe, expect, it, vi } from "vitest";
import { assertNotImpersonating } from "../hooks/impersonation-guard";

const impersonated = async () => ({
	session: { impersonatedBy: "admin-1" },
});
const ownSession = async () => ({ session: { impersonatedBy: null } });
const noSession = async () => null;

/** Account takeover, money and third-party-access paths (plan v2 §4). */
const GUARDED_PATHS = [
	"/change-email",
	"/change-password",
	"/delete-user",
	"/delete-user/callback",
	"/two-factor/enable",
	"/two-factor/disable",
	"/two-factor/generate-backup-codes",
	"/passkey/generate-register-options",
	"/passkey/verify-registration",
	"/passkey/delete-passkey",
	"/link-social",
	"/unlink-account",
	"/oauth2/authorize",
	"/oauth2/consent",
	"/oauth2/continue",
	"/oauth2/update-consent",
	"/oauth2/create-client",
	"/organization/leave",
	"/organization/delete",
	"/organization/invite-member",
	"/organization/accept-invitation",
	"/get-access-token",
	"/refresh-token",
	"/account-info",
	"/oauth2/client/rotate-secret",
	"/oauth2/update-client",
	// Switching to (or revoking into) another device session would leave
	// impersonation without the audited stop.
	"/multi-session/set-active",
	"/multi-session/revoke",
];

describe("assertNotImpersonating (hooks.before)", () => {
	it.each(GUARDED_PATHS)(
		"rejects %s for an impersonation session",
		async (path) => {
			const error = await assertNotImpersonating({
				path,
				getSession: impersonated,
			}).catch((e: unknown) => e);
			expect(error).toBeInstanceOf(APIError);
			expect(error).toMatchObject({
				statusCode: 403,
				body: { code: "IMPERSONATION_FORBIDDEN" },
			});
		},
	);

	it.each(GUARDED_PATHS)(
		"allows %s for the user's own session",
		async (path) => {
			await expect(
				assertNotImpersonating({ path, getSession: ownSession }),
			).resolves.toBeUndefined();
		},
	);

	it("allows guarded paths without a session (endpoint handles auth)", async () => {
		await expect(
			assertNotImpersonating({
				path: "/change-password",
				getSession: noSession,
			}),
		).resolves.toBeUndefined();
	});

	it.each([
		"/get-session",
		"/update-user",
		"/sign-out",
		"/admin/stop-impersonating",
		"/organization/delete-role",
		"/organization/set-active",
		undefined,
	])("never reads the session on unguarded path %s", async (path) => {
		const getSession = vi.fn(impersonated);
		await expect(
			assertNotImpersonating({ path, getSession }),
		).resolves.toBeUndefined();
		expect(getSession).not.toHaveBeenCalled();
	});
});
