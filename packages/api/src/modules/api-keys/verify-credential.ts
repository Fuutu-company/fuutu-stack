import { getOrganizationMemberRole, verifyApiKeyWithOwner } from "@fuutu/db";
import { toSystemRole } from "@fuutu/rbac";
import { API_KEY_ADMIN_SCOPES } from "../../api-key-scopes";

type VerifiedKey = NonNullable<
	Awaited<ReturnType<typeof verifyApiKeyWithOwner>>
>;

export type ApiKeyCredential = VerifiedKey & {
	/** The owner's current member role in the key's org (org keys only). */
	orgRole: string | null;
};

/**
 * The single verify path for every API-key surface — oRPC/REST context,
 * `requireApiKey` and the MCP principal. Re-checks the owner on every use
 * and fails closed (`null` → 401) when:
 *  - the key is unknown, revoked or expired, or its owner is gone
 *  - the owner is banned
 *  - the key carries an admin scope (`API_KEY_ADMIN_SCOPES`) and the owner
 *    is no longer a system admin
 *  - it is an org key and the owner is no longer a member of that org
 *
 * Surface-specific rules (which scope a surface needs, plan feature gates)
 * stay with the caller.
 */
export async function verifyApiKeyCredential(
	rawKey: string,
): Promise<ApiKeyCredential | null> {
	const verified = await verifyApiKeyWithOwner(rawKey);
	if (!verified || verified.user.banned) return null;
	const { apiKey, user } = verified;

	const needsSystemAdmin = apiKey.scopes.some((scope) =>
		(API_KEY_ADMIN_SCOPES as readonly string[]).includes(scope),
	);
	if (needsSystemAdmin && toSystemRole(user.role) !== "admin") return null;

	if (!apiKey.organizationId) return { apiKey, user, orgRole: null };
	const orgRole = await getOrganizationMemberRole(
		apiKey.organizationId,
		user.id,
	);
	if (orgRole === null) return null;
	return { apiKey, user, orgRole };
}
