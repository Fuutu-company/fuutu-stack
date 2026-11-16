import { describe, expect, it } from "vitest";
import {
	hasOrgPermission,
	hasSystemPermission,
	OrgAccessControl,
	SystemAccessControl,
} from "../index";
import { ORG_POLICY, PERMISSIONS, SYSTEM_POLICY } from "../policy";

const systemAC = new SystemAccessControl(SYSTEM_POLICY);
const orgAC = new OrgAccessControl(ORG_POLICY);

describe("system-admin permissions", () => {
	it("names the admin-organization resource and impersonation permission", () => {
		expect(PERMISSIONS.ADMIN_ORGANIZATION).toEqual({
			VIEW: "view:admin-organization",
			CREATE: "create:admin-organization",
			UPDATE: "update:admin-organization",
			DELETE: "delete:admin-organization",
		});
		expect(PERMISSIONS.IMPERSONATE_USER).toBe("impersonate:user");
	});

	it.each([
		"view:admin-organization",
		"update:admin-organization",
		"delete:admin-organization",
		"impersonate:user",
	] as const)("only a system admin holds %s", (permission) => {
		expect(hasSystemPermission(systemAC, "admin", permission)).toBe(true);
		expect(hasSystemPermission(systemAC, "user", permission)).toBe(false);
	});

	it("does not grant create:admin-organization (support never creates orgs)", () => {
		expect(
			hasSystemPermission(systemAC, "admin", "create:admin-organization"),
		).toBe(false);
	});

	it.each(["owner", "admin", "member"] as const)(
		"org role %s holds no system-admin permission",
		(role) => {
			for (const permission of [
				PERMISSIONS.ADMIN_ORGANIZATION.VIEW,
				PERMISSIONS.ADMIN_ORGANIZATION.UPDATE,
				PERMISSIONS.ADMIN_ORGANIZATION.DELETE,
				PERMISSIONS.IMPERSONATE_USER,
			]) {
				expect(hasOrgPermission(orgAC, role, permission)).toBe(false);
			}
		},
	);

	it("keeps org management out of the system policy", () => {
		expect(
			hasSystemPermission(systemAC, "admin", PERMISSIONS.ORGANIZATION.UPDATE),
		).toBe(false);
		expect(
			hasSystemPermission(systemAC, "admin", PERMISSIONS.ORGANIZATION.DELETE),
		).toBe(false);
	});
});
