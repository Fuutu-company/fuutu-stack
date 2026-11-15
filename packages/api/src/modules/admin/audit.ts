import { createAuditLogger } from "@fuutu/logs";
import { getClientIp } from "../../client-ip";

const audit = createAuditLogger({ scope: "admin" });

/** `admin.<domain>.<verb>`, e.g. `admin.user.ban`, `admin.org.rename`. */
export type AdminAuditAction = `admin.${string}.${string}`;

export type AdminAuditEntry = {
	action: AdminAuditAction;
	/** Defaults to the signed-in user (`context.user.id`). */
	actorUserId?: string;
	targetUserId?: string;
	targetOrganizationId?: string;
	/** An organization invitation — the invitee's email stays out. */
	targetInvitationId?: string;
	reason?: string;
	/** Names of the fields an update changed — never their values. */
	changedFields?: string[];
};

/**
 * Audit row for a support action. `userId` is the acting admin and
 * `organizationId` stays null — customer org audit pages must not list
 * support actions; targets live in metadata (`listAuditLogs` timelines
 * read them). Ids only, no emails: the audit log outlives user deletion.
 */
export async function recordAdminAction(
	context: { user: { id: string }; headers: Headers },
	entry: AdminAuditEntry,
): Promise<void> {
	const { action, actorUserId, ...details } = entry;
	const metadata = Object.fromEntries(
		Object.entries(details).filter(([, value]) => value !== undefined),
	);
	await audit.record({
		action,
		userId: actorUserId ?? context.user.id,
		organizationId: null,
		ip: getClientIp(context.headers),
		userAgent: context.headers.get("user-agent"),
		metadata,
	});
}
