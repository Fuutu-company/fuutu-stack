/**
 * Support impersonation lasts only while the impersonating admin may still
 * impersonate — shared by Better Auth's `hooks.before`, the API context and
 * the app's server guards. Server-only (reads the database).
 */
import { getUserAccessState, isUserSessionLive } from "@fuutu/db";
import {
	hasSystemPermission,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toSystemRole,
} from "@fuutu/rbac";
import type { ImpersonationSessionLike } from "./impersonation";
import {
	type ExpiredImpersonationSession,
	endImpersonation,
} from "./impersonation-expiry";
import { isBanActive } from "./types";

const systemAC = new SystemAccessControl(SYSTEM_POLICY);

/**
 * True when `session` is an impersonation whose admin was demoted, banned
 * or deleted — it ends at once, not when the cookie-cached session runs
 * out. Cost: one primary-key user read, impersonation sessions only.
 */
export async function hasImpersonatorLostAccess({
	impersonatedBy,
}: ImpersonationSessionLike): Promise<boolean> {
	if (!impersonatedBy) return false;
	const impersonator = await getUserAccessState(impersonatedBy);
	return (
		!impersonator ||
		isBanActive(impersonator) ||
		!hasSystemPermission(
			systemAC,
			toSystemRole(impersonator.role),
			PERMISSIONS.IMPERSONATE_USER,
		)
	);
}

/**
 * The detectors' path (Better Auth's hooks, the API context, the app's
 * server guards): true when an impersonation must count as signed out —
 * its session row is gone (the cookie cache may still hold it for up to
 * 5 minutes) or the impersonator lost access. Lost access deletes the row
 * and records `admin.user.impersonate_ended_lost_access` (once, by the
 * detector that removed it), so a restored role never revives it. Cost:
 * two primary-key reads, impersonation sessions only.
 */
export async function endImpersonationIfAccessLost(
	session: ExpiredImpersonationSession & ImpersonationSessionLike,
): Promise<boolean> {
	if (!session.impersonatedBy) return false;
	const [live, lostAccess] = await Promise.all([
		isUserSessionLive({ userId: session.userId, sessionId: session.id }),
		hasImpersonatorLostAccess(session),
	]);
	if (!live) return true;
	if (!lostAccess) return false;
	await endImpersonation(session, "lost_access");
	return true;
}
