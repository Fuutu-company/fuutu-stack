/**
 * Remember the user's active organization across sign-ins.
 *
 * Better Auth keeps `activeOrganizationId` on the session only, so a new
 * sign-in always started in the personal workspace. These helpers back two
 * database hooks:
 *  - `session.update.before` → `persistActiveOrganizationChange`: the org
 *    plugin switches orgs via `updateSession({ activeOrganizationId })`
 *    (set-active, create, delete, leave), so a write carrying that key is
 *    an org switch and is mirrored to `user.lastActiveOrganizationId`.
 *  - `session.create.before` → `restoreActiveOrganization`: a fresh session
 *    starts in that org again, if the user is still a member.
 * Both are best-effort: a failure must never break sign-in or switching.
 */
import {
	getUserById,
	isOrganizationMember,
	setLastActiveOrganization,
} from "@fuutu/db";
import { createLogger } from "@fuutu/logs";

const log = createLogger({ scope: "auth" });

export async function persistActiveOrganizationChange(
	update: Record<string, unknown>,
	userId: string | undefined,
): Promise<void> {
	if (!userId || !("activeOrganizationId" in update)) return;
	const organizationId =
		typeof update.activeOrganizationId === "string"
			? update.activeOrganizationId
			: null;
	try {
		await setLastActiveOrganization(userId, organizationId);
	} catch (err) {
		log.warn("persist last active organization failed", { err: String(err) });
	}
}

export async function restoreActiveOrganization(session: {
	userId: string;
	activeOrganizationId?: unknown;
}): Promise<string | null> {
	if (typeof session.activeOrganizationId === "string") return null;
	try {
		const user = await getUserById(session.userId);
		const organizationId = user?.lastActiveOrganizationId;
		if (!organizationId) return null;
		return (await isOrganizationMember(session.userId, organizationId))
			? organizationId
			: null;
	} catch (err) {
		log.warn("restore last active organization failed", { err: String(err) });
		return null;
	}
}
