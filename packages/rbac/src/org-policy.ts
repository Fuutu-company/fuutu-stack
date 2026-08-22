import type { OrgAccessPolicy } from "./index";
import { crud, PERMISSIONS } from "./permissions";

/**
 * Org policy — what a user may do based on their role WITHIN an organization.
 *
 * Source: Better-Auth `organization` plugin → `member.role`
 * Roles:  "member" | "admin" | "owner"
 *
 * Checked by: `requireOrgPermission()` / `requireOrgPermissionAccess()` / `requireOrgRole()`
 *
 * Design principle: The org `member` base tier mirrors the system `user` base tier
 * for resources that exist in both scopes. The admin/owner tiers add management, not
 * more resource access.
 *
 * - member: full CRUD on org resources (api-key, webhook, chat, storage, crm) + view credit/activity/payment
 * - admin:  everything member has + manage members, update org, manage billing portal
 * - owner:  everything admin has + delete org, manage billing
 *
 * Note: Notifications are NOT here — they are always user-scoped (checked via SYSTEM_POLICY).
 */
export const ORG_POLICY: OrgAccessPolicy = {
	member: [
		// Org-scoped resources — full CRUD (member can use these like a user would)
		...crud("api-key"),
		...crud("webhook"),
		...crud("chat"),
		...crud("storage"),
		...crud("crm"),
		// View-only resources
		PERMISSIONS.CREDIT.VIEW,
		PERMISSIONS.ACTIVITY.VIEW,
		PERMISSIONS.PAYMENT.VIEW,
		// Organization — view only (update/delete gated by admin/owner below)
		PERMISSIONS.ORGANIZATION.VIEW,
	],
	admin: [
		// Org management
		PERMISSIONS.ORGANIZATION.UPDATE,
		PERMISSIONS.INVITE_ORGANIZATION,
		PERMISSIONS.REMOVE_ORGANIZATION,
		// Payment management (checkouts, billing portal, cancel subscription)
		PERMISSIONS.PAYMENT.CREATE,
		PERMISSIONS.PAYMENT.UPDATE,
	],
	owner: [PERMISSIONS.ORGANIZATION.DELETE, PERMISSIONS.MANAGE_BILLING],
};
