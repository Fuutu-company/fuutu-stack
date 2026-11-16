import { getConversationScope } from "@fuutu/db";
import type { KnownPermission } from "@fuutu/rbac";
import { ORPCError } from "@orpc/server";
import {
	type OrgAccessContext,
	requireOrgPermissionAccess,
} from "../../orpc/org-access";

/**
 * Owning an org conversation is not enough: the caller must still be a
 * member of its organization with `permission` (FORBIDDEN otherwise, also
 * for an org-scoped API key of another org). Personal conversations need
 * no org check — the queries already enforce ownership.
 */
export async function requireConversationOrgAccess(
	conversation: { organizationId: string | null },
	userId: string,
	permission: KnownPermission,
	access: OrgAccessContext,
): Promise<void> {
	if (!conversation.organizationId) return;
	await requireOrgPermissionAccess(
		conversation.organizationId,
		userId,
		permission,
		access,
	);
}

/** The caller's conversation (NOT_FOUND if missing or foreign), org-checked. */
export async function requireConversationAccess(
	conversationId: string,
	userId: string,
	permission: KnownPermission,
	access: OrgAccessContext,
): Promise<void> {
	const conversation = await getConversationScope(conversationId, userId);
	if (!conversation) {
		throw new ORPCError("NOT_FOUND", { message: "Conversation not found" });
	}
	await requireConversationOrgAccess(conversation, userId, permission, access);
}
