/**
 * Org API keys end with the membership. Verification already rejects a
 * non-member's org key, but a rejoin would revive it — so leaving or being
 * removed revokes the user's keys for that organization for good.
 */
import { revokeOrgApiKeysForUser } from "@fuutu/db";

/**
 * `organizationHooks.beforeRemoveMember` — runs after Better Auth's own
 * checks; a failed revoke aborts the removal (fail closed).
 */
export async function revokeApiKeysOfRemovedMember(member: {
	organizationId: string;
	userId: string;
}): Promise<void> {
	await revokeOrgApiKeysForUser(member.organizationId, member.userId);
}

/**
 * `hooks.after` on `/organization/leave` — Better Auth runs no
 * organizationHooks there. Only once leaving succeeded (not on an APIError).
 */
export async function revokeApiKeysAfterLeave(input: {
	path: string | undefined;
	returned: unknown;
	body: unknown;
	userId: string | undefined;
}): Promise<void> {
	if (input.path !== "/organization/leave") return;
	if (input.returned instanceof Error || !input.userId) return;
	const organizationId =
		typeof input.body === "object" &&
		input.body !== null &&
		"organizationId" in input.body
			? input.body.organizationId
			: undefined;
	if (typeof organizationId !== "string" || !organizationId) return;
	await revokeOrgApiKeysForUser(organizationId, input.userId);
}
