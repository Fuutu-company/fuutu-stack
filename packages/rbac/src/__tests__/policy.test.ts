import { describe, expect, it } from "vitest";
import {
	hasOrgPermission,
	hasSystemPermission,
	OrgAccessControl,
	SystemAccessControl,
} from "../index";
import { ORG_POLICY, PERMISSIONS, SYSTEM_POLICY } from "../policy";

describe("SYSTEM_POLICY", () => {
	const ac = new SystemAccessControl(SYSTEM_POLICY);

	it("user can view api-keys", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.API_KEY.VIEW)).toBe(
			true,
		);
	});
	it("user cannot view admin", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.VIEW_ADMIN)).toBe(false);
	});
	it("admin can view admin", () => {
		expect(hasSystemPermission(ac, "admin", PERMISSIONS.VIEW_ADMIN)).toBe(true);
	});
	it("admin inherits user permissions", () => {
		expect(hasSystemPermission(ac, "admin", PERMISSIONS.API_KEY.VIEW)).toBe(
			true,
		);
	});
	it("user can use ai", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.USE_AI)).toBe(true);
	});
	it("user can create organizations", () => {
		expect(
			hasSystemPermission(ac, "user", PERMISSIONS.ORGANIZATION.CREATE),
		).toBe(true);
	});
	it("admin can manage users", () => {
		expect(hasSystemPermission(ac, "admin", PERMISSIONS.USER.VIEW)).toBe(true);
	});
	it("admin can view audit logs", () => {
		expect(hasSystemPermission(ac, "admin", PERMISSIONS.AUDIT_LOG.VIEW)).toBe(
			true,
		);
	});
	it("user cannot manage users", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.USER.VIEW)).toBe(false);
	});
	it("user can view organizations", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.ORGANIZATION.VIEW)).toBe(
			true,
		);
	});
	it("user cannot update organizations (org-level decision)", () => {
		expect(
			hasSystemPermission(ac, "user", PERMISSIONS.ORGANIZATION.UPDATE),
		).toBe(false);
	});
	it("user cannot delete organizations (org-level decision)", () => {
		expect(
			hasSystemPermission(ac, "user", PERMISSIONS.ORGANIZATION.DELETE),
		).toBe(false);
	});
	it("user can view notifications", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.NOTIFICATION.VIEW)).toBe(
			true,
		);
	});
	it("user can update notifications (mark as read)", () => {
		expect(
			hasSystemPermission(ac, "user", PERMISSIONS.NOTIFICATION.UPDATE),
		).toBe(true);
	});
	it("user cannot create notifications (system-generated)", () => {
		expect(
			hasSystemPermission(ac, "user", PERMISSIONS.NOTIFICATION.CREATE),
		).toBe(false);
	});
	it("user can view credits", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.CREDIT.VIEW)).toBe(true);
	});
	it("user cannot create credits (purchased, not created)", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.CREDIT.CREATE)).toBe(
			false,
		);
	});
	it("user can view activity", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.ACTIVITY.VIEW)).toBe(
			true,
		);
	});
	it("user cannot create activity (system-generated)", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.ACTIVITY.CREATE)).toBe(
			false,
		);
	});
	it("user has no webhook permissions (webhooks are org-only)", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.WEBHOOK.VIEW)).toBe(
			false,
		);
		expect(hasSystemPermission(ac, "user", PERMISSIONS.WEBHOOK.CREATE)).toBe(
			false,
		);
	});
	it("user can view payments", () => {
		expect(hasSystemPermission(ac, "user", PERMISSIONS.PAYMENT.VIEW)).toBe(
			true,
		);
	});
});

describe("ORG_POLICY", () => {
	const ac = new OrgAccessControl(ORG_POLICY);

	it("member can view organization", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.ORGANIZATION.VIEW)).toBe(
			true,
		);
	});
	it("member cannot invite to organization", () => {
		expect(
			hasOrgPermission(ac, "member", PERMISSIONS.INVITE_ORGANIZATION),
		).toBe(false);
	});
	it("admin can invite to organization", () => {
		expect(hasOrgPermission(ac, "admin", PERMISSIONS.INVITE_ORGANIZATION)).toBe(
			true,
		);
	});
	it("admin can remove from organization", () => {
		expect(hasOrgPermission(ac, "admin", PERMISSIONS.REMOVE_ORGANIZATION)).toBe(
			true,
		);
	});
	it("admin can update organization", () => {
		expect(hasOrgPermission(ac, "admin", PERMISSIONS.ORGANIZATION.UPDATE)).toBe(
			true,
		);
	});
	it("admin cannot delete organization", () => {
		expect(hasOrgPermission(ac, "admin", PERMISSIONS.ORGANIZATION.DELETE)).toBe(
			false,
		);
	});
	it("owner can delete organization", () => {
		expect(hasOrgPermission(ac, "owner", PERMISSIONS.ORGANIZATION.DELETE)).toBe(
			true,
		);
	});
	it("owner can manage billing", () => {
		expect(hasOrgPermission(ac, "owner", PERMISSIONS.MANAGE_BILLING)).toBe(
			true,
		);
	});
	it("owner inherits admin permissions", () => {
		expect(hasOrgPermission(ac, "owner", PERMISSIONS.INVITE_ORGANIZATION)).toBe(
			true,
		);
	});

	// Member base tier — mirrors system user for shared resources
	it("member has full CRUD on api-keys", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.API_KEY.VIEW)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.API_KEY.CREATE)).toBe(
			true,
		);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.API_KEY.DELETE)).toBe(
			true,
		);
	});
	it("member has full CRUD on webhooks", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.WEBHOOK.VIEW)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.WEBHOOK.CREATE)).toBe(
			true,
		);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.WEBHOOK.DELETE)).toBe(
			true,
		);
	});
	it("member has full CRUD on chat", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CHAT.VIEW)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CHAT.CREATE)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CHAT.DELETE)).toBe(true);
	});
	it("member has full CRUD on crm", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CRM.VIEW)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CRM.CREATE)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CRM.DELETE)).toBe(true);
	});
	it("member has full CRUD on storage", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.STORAGE.VIEW)).toBe(true);
		expect(hasOrgPermission(ac, "member", PERMISSIONS.STORAGE.DELETE)).toBe(
			true,
		);
	});
	it("member can view credits", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.CREDIT.VIEW)).toBe(true);
	});
	it("member can view activity", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.ACTIVITY.VIEW)).toBe(
			true,
		);
	});
	it("member can view payments", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.PAYMENT.VIEW)).toBe(true);
	});
	it("member cannot update organization (admin-only)", () => {
		expect(
			hasOrgPermission(ac, "member", PERMISSIONS.ORGANIZATION.UPDATE),
		).toBe(false);
	});
	it("admin can create payments (checkouts)", () => {
		expect(hasOrgPermission(ac, "admin", PERMISSIONS.PAYMENT.CREATE)).toBe(
			true,
		);
	});
	it("member cannot create payments", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.PAYMENT.CREATE)).toBe(
			false,
		);
	});
	// Notifications are user-scoped, not org-scoped — not in ORG_POLICY
	it("member has no notification permissions in org policy", () => {
		expect(hasOrgPermission(ac, "member", PERMISSIONS.NOTIFICATION.VIEW)).toBe(
			false,
		);
	});
});
