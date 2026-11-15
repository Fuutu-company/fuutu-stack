/**
 * Every Better Auth request of a support impersonation (`impersonatedBy`
 * set) — not only the paths `impersonation-guard` blocks — ends once
 * `authConfig.admin.impersonationMinutes` are over or the impersonating
 * admin lost the permission. Better Auth alone would keep the session: a
 * dropped `dont_remember` cookie even lets `/get-session` extend the row
 * to the normal session lifetime.
 */
import { APIError } from "better-auth/api";
import { isImpersonationExpired } from "../impersonation";
import { endImpersonationIfAccessLost } from "../impersonation-access";
import { endExpiredImpersonation } from "../impersonation-expiry";

type ImpersonationSession = {
	id: string;
	userId: string;
	impersonatedBy?: string | null;
	createdAt: Date | string;
};

type SessionLookup = () => Promise<{ session: ImpersonationSession } | null>;

/** Checked on its result instead — server reads get `null`, not an error. */
const GET_SESSION_PATH = "/get-session";

/** `/sign-out` always works; `/get-session` is checked in `hooks.after`. */
const UNCHECKED_PATHS: ReadonlySet<string> = new Set([
	GET_SESSION_PATH,
	"/sign-out",
]);

/**
 * True when `session` is an impersonation that must count as signed out.
 * An expired one, or one whose admin lost access, is ended (row deleted,
 * audited once). Cost: only
 * impersonation sessions pay the extra DB read (the impersonator).
 */
async function isEndedImpersonation(
	session: ImpersonationSession | null | undefined,
): Promise<boolean> {
	if (!session?.impersonatedBy) return false;
	if (isImpersonationExpired(session)) {
		await endExpiredImpersonation(session);
		return true;
	}
	return endImpersonationIfAccessLost(session);
}

/**
 * `hooks.before`: rejects an ended impersonation with 401
 * (`IMPERSONATION_ENDED`) — `/admin/stop-impersonating` included, so it
 * only works while the impersonation is still valid. The session read is
 * the one Better Auth endpoints make anyway (cached on the request).
 */
export async function assertImpersonationActive(input: {
	path: string | undefined;
	getSession: SessionLookup;
}): Promise<void> {
	if (!input.path || UNCHECKED_PATHS.has(input.path)) return;
	const current = await input.getSession();
	if (!(await isEndedImpersonation(current?.session))) return;
	throw new APIError("UNAUTHORIZED", {
		message: "Impersonation has ended",
		code: "IMPERSONATION_ENDED",
	});
}

/**
 * `hooks.after`: true when `/get-session` returned an ended impersonation —
 * the caller answers `null` (signed out) instead.
 */
export async function isEndedImpersonationResult(input: {
	path: string | undefined;
	returned: unknown;
}): Promise<boolean> {
	if (input.path !== GET_SESSION_PATH) return false;
	return isEndedImpersonation(sessionOf(input.returned));
}

function sessionOf(returned: unknown): ImpersonationSession | null {
	if (!returned || typeof returned !== "object" || !("session" in returned)) {
		return null;
	}
	const { session } = returned;
	if (!session || typeof session !== "object") return null;
	return session as ImpersonationSession;
}
