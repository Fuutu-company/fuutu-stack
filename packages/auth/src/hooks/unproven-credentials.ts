/**
 * When a magic link or an email OTP proves the mailbox of an UNVERIFIED
 * account, Better Auth (`revokeUnprovenAccountAccess`) treats everything
 * the account accrued before as possibly a squatter's: it deletes its
 * accounts (password, OAuth links) and sessions, then sets
 * `emailVerified`. Passkeys, the TOTP secret, API keys and MCP OAuth tokens
 * would survive and keep the squatter signed in — they go too.
 *
 * Hook point: `databaseHooks.user.update` — that update
 * (`{ emailVerified: true }`) is the only user update those two endpoints
 * make for an existing account. `before` marks the request and turns 2FA
 * off on the same write; `after` (which has the user id) removes the rows.
 * Primary defense is `verified-email-credentials.ts` (no such credential
 * before the email is verified); this cleans up the rest.
 */

/** Endpoints that call `revokeUnprovenAccountAccess` (Better Auth 1.7). */
const MAILBOX_PROOF_PATHS: ReadonlySet<string> = new Set([
	"/magic-link/verify",
	"/sign-in/email-otp",
]);

type EndpointContext = { path?: string } | null | undefined;

const pendingProofs = new WeakSet<object>();

/**
 * `user.update.before`: on a mailbox proof, marks the request and adds
 * `twoFactorEnabled: false` to the write (`twoFactor`: plugin active).
 */
export function markMailboxProof(
	data: Record<string, unknown>,
	ctx: EndpointContext,
	options: { twoFactor: boolean },
): { data: Record<string, unknown> } | undefined {
	if (!ctx?.path || !MAILBOX_PROOF_PATHS.has(ctx.path)) return;
	if (data.emailVerified !== true) return;
	pendingProofs.add(ctx);
	return {
		data: options.twoFactor ? { ...data, twoFactorEnabled: false } : data,
	};
}

/** `user.update.after`: removes the credentials of a marked request's user. */
export async function revokeUnprovenCredentials(
	user: { id: string },
	ctx: EndpointContext,
	deps: {
		deletePasskeys: (userId: string) => Promise<unknown>;
		deleteTwoFactor: (userId: string) => Promise<unknown>;
		revokeApiKeys: (userId: string) => Promise<unknown>;
		revokeOAuthTokens: (userId: string) => Promise<unknown>;
	},
): Promise<void> {
	if (!ctx || !pendingProofs.delete(ctx)) return;
	await deps.deletePasskeys(user.id);
	await deps.deleteTwoFactor(user.id);
	await deps.revokeApiKeys(user.id);
	await deps.revokeOAuthTokens(user.id);
}
