/**
 * Support impersonation (Better Auth admin plugin) — time limit shared by
 * the API context and the app's server guards. Pure: no Better Auth
 * import, so client-free server code and tests can use it directly.
 */
import { authConfig } from "./config";

export type ImpersonationSessionLike = {
	impersonatedBy?: string | null;
	createdAt: Date | string;
};

/**
 * True when `session` is an impersonation session older than
 * `authConfig.admin.impersonationMinutes`. Counted from `createdAt`, not
 * `expiresAt`, so session refreshes and cached cookies never extend it.
 * An unreadable `createdAt` counts as expired — fail closed.
 */
export function isImpersonationExpired(
	session: ImpersonationSessionLike | null | undefined,
	now: number = Date.now(),
): boolean {
	if (!session?.impersonatedBy) return false;
	const startedAt = new Date(session.createdAt).getTime();
	if (Number.isNaN(startedAt)) return true;
	return now >= startedAt + authConfig.admin.impersonationMinutes * 60_000;
}
