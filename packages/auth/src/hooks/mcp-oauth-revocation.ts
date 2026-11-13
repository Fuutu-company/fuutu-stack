/**
 * OAuth token revocation tied to account security events. MCP refresh
 * tokens outlive browser sessions (30 days), so ending sessions or changing
 * the password must end them too; deleting a consent through the provider's
 * own `/oauth2/delete-consent` must not leave its tokens usable either.
 * Password resets revoke via `emailAndPassword.onPasswordReset`.
 */
import { getOAuthConsentOwner, revokeOAuthTokensForUser } from "@fuutu/db";

const REVOKE_ALL_TOKENS_AFTER: ReadonlySet<string> = new Set([
	"/change-password",
	"/revoke-sessions",
	"/revoke-other-sessions",
]);

/** `hooks.after`: revoke once the endpoint succeeded (not on an APIError). */
export async function revokeOAuthTokensAfterAccountChange(input: {
	path: string | undefined;
	returned: unknown;
	userId: string | undefined;
}): Promise<void> {
	if (!input.path || !REVOKE_ALL_TOKENS_AFTER.has(input.path)) return;
	if (input.returned instanceof Error || !input.userId) return;
	await revokeOAuthTokensForUser(input.userId);
}

/** `hooks.before` on `/oauth2/delete-consent` (the provider only deletes the row). */
export async function revokeOAuthTokensBeforeConsentDelete(input: {
	path: string | undefined;
	body: unknown;
	userId: string | undefined;
}): Promise<void> {
	if (input.path !== "/oauth2/delete-consent" || !input.userId) return;
	const id =
		typeof input.body === "object" && input.body !== null && "id" in input.body
			? input.body.id
			: undefined;
	if (typeof id !== "string" || !id) return;
	const consent = await getOAuthConsentOwner(id);
	if (!consent || consent.userId !== input.userId) return;
	await revokeOAuthTokensForUser(input.userId, consent.clientId);
}
