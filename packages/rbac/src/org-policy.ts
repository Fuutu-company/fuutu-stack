import type { OrgAccessPolicy } from "./index";
import { crud, PERMISSIONS } from "./permissions";

/**
 * Org policy — what a user may do based on their role WITHIN an organization.
 *
 * Source: Better-Auth `organization` plugin → `member.role`
 * Roles:  "member" | "admin" | "owner"
 *
 * Checked by: `requireOrgPermission()` / `requireOrgPermissionAccess()`
 *
 * Design principle: The org `member` base tier mirrors the system `user` base tier
 * for resources that exist in both scopes. The admin/owner tiers add management, not
 * more resource access.
 *
 * - member: full CRUD on org resources (chat, storage, crm) + view/create/update api-key + view webhook/credit/activity/payment
 * - admin:  everything member has + create/update/delete webhooks, revoke/delete any org api-key, manage members, update org, manage billing (checkout, portal, cancel)
 * - owner:  everything admin has + delete org
 *
 * Note: Notifications are NOT here — they are always user-scoped (checked via SYSTEM_POLICY).
 */
export const ORG_POLICY: OrgAccessPolicy = Object.freeze({
	member: Object.freeze([
		// Org-scoped resources — full CRUD (member can use these like a user would)
		// API keys: no DELETE — revoking any org key is admin-only; a member
		// revokes the keys they created (creator check in apiKeys.revoke/delete).
		PERMISSIONS.API_KEY.VIEW,
		PERMISSIONS.API_KEY.CREATE,
		PERMISSIONS.API_KEY.UPDATE,
		...crud("chat"),
		// Storage: a bucket in BUCKET_WRITE_ORG_PERMISSION (api storage
		// module) also needs that permission — organization-logos writes
		// and deletes need ORGANIZATION.UPDATE.
		...crud("storage"),
		...crud("crm"),
		// View-only resources
		PERMISSIONS.WEBHOOK.VIEW,
		PERMISSIONS.CREDIT.VIEW,
		PERMISSIONS.ACTIVITY.VIEW,
		PERMISSIONS.PAYMENT.VIEW,
		// Organization — view only (update/delete gated by admin/owner below)
		PERMISSIONS.ORGANIZATION.VIEW,
	]),
	admin: Object.freeze([
		// Revoke/delete any org API key, an admin's included
		PERMISSIONS.API_KEY.DELETE,
		// Webhooks keep receiving org events after their creator leaves
		PERMISSIONS.WEBHOOK.CREATE,
		PERMISSIONS.WEBHOOK.UPDATE,
		PERMISSIONS.WEBHOOK.DELETE,
		// Org management
		PERMISSIONS.ORGANIZATION.UPDATE,
		PERMISSIONS.INVITE_MEMBER,
		PERMISSIONS.REMOVE_MEMBER,
		// Payment management (checkouts, billing portal, cancel subscription)
		PERMISSIONS.PAYMENT.CREATE,
		PERMISSIONS.PAYMENT.UPDATE,
		// Org audit log is sensitive — admin-only within the org
		PERMISSIONS.AUDIT_LOG.VIEW,
	]),
	owner: Object.freeze([PERMISSIONS.ORGANIZATION.DELETE]),
});
