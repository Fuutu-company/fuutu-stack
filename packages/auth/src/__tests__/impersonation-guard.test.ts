import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";
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
	// Organization management: membership, roles, invitations and the
	// organization's identity (name, slug, logo).
	"/organization/update",
	"/organization/remove-member",
	"/organization/update-member-role",
	"/organization/cancel-invitation",
	"/organization/reject-invitation",
	"/organization/create-role",
	"/organization/update-role",
	"/organization/delete-role",
	"/organization/create-team",
	"/organization/update-team",
	"/organization/remove-team",
	"/organization/add-team-member",
	"/organization/remove-team-member",
	// The user's profile and their other device sessions.
	"/update-user",
	"/revoke-session",
	"/revoke-sessions",
	"/revoke-other-sessions",
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
		"/list-sessions",
		"/sign-out",
		"/admin/stop-impersonating",
		"/organization/create",
		"/organization/set-active",
		"/organization/set-active-team",
		"/organization/get-full-organization",
		"/organization/list-members",
		undefined,
	])("never reads the session on unguarded path %s", async (path) => {
		const getSession = vi.fn(impersonated);
		await expect(
			assertNotImpersonating({ path, getSession }),
		).resolves.toBeUndefined();
		expect(getSession).not.toHaveBeenCalled();
	});
});

/**
 * Every Better Auth organization mutation (teams and dynamic roles enabled,
 * so nothing is hidden) is guarded unless listed here. A new endpoint in a
 * Better Auth update fails this test until it is classified.
 */
const ORGANIZATION_MUTATIONS_ALLOWED_WHILE_IMPERSONATING = new Set([
	// A new organization of the user's own — changes nothing that exists
	// (oRPC `organizations.create` allows it too).
	"/organization/create",
	// Navigation: which organization / team the session looks at.
	"/organization/set-active",
	"/organization/set-active-team",
	// Read-only checks sent as POST.
	"/organization/check-slug",
	"/organization/has-permission",
]);

describe("organization plugin coverage", () => {
	const plugin = organization({
		teams: { enabled: true },
		dynamicAccessControl: { enabled: true },
	});
	const mutations = Object.values(plugin.endpoints)
		.filter((endpoint) => {
			const method = endpoint.options.method;
			const methods = Array.isArray(method) ? method : [method];
			return methods.some((m) => m !== "GET");
		})
		.map((endpoint) => endpoint.path)
		// Server-only endpoints (`addMember`) have no path and no HTTP route.
		.filter((path): path is string => typeof path === "string")
		.filter(
			(path) => !ORGANIZATION_MUTATIONS_ALLOWED_WHILE_IMPERSONATING.has(path),
		);

	it("finds the organization mutations", () => {
		expect(mutations).toContain("/organization/remove-member");
	});

	it.each(mutations)("guards %s", async (path) => {
		await expect(
			assertNotImpersonating({ path, getSession: impersonated }),
		).rejects.toMatchObject({ body: { code: "IMPERSONATION_FORBIDDEN" } });
	});
});
