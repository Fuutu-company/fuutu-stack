import { PERMISSIONS, SYSTEM_POLICY, SystemAccessControl } from "@fuutu/rbac";
import { describe, expect, it } from "vitest";
import { getUserRole, type UserWithRole, userHasPermission } from "../types";

/** Minimal valid user shape for type checking. */
function u(role: string | null | undefined): UserWithRole {
	return {
		id: "test-id",
		email: "test@fuutu.local",
		name: "Test User",
		role,
	};
}

const systemAc = new SystemAccessControl(SYSTEM_POLICY);

describe("getUserRole()", () => {
	it("returns 'admin' for single admin role", () => {
		expect(getUserRole(u("admin"))).toBe("admin");
	});

	it("returns 'admin' for comma-separated 'admin,user' (multi-role bug case)", () => {
		expect(getUserRole(u("admin,user"))).toBe("admin");
	});

	it("returns 'user' for 'owner' (owner is org-only, not a system role)", () => {
		expect(getUserRole(u("owner"))).toBe("user");
		expect(getUserRole(u("admin,owner"))).toBe("admin");
	});

	it("returns 'user' for single 'user' role", () => {
		expect(getUserRole(u("user"))).toBe("user");
	});

	it("returns 'user' for unknown roles", () => {
		expect(getUserRole(u("superuser"))).toBe("user");
	});

	it("returns 'user' for empty string", () => {
		expect(getUserRole(u(""))).toBe("user");
	});

	it("returns 'user' for null role", () => {
		expect(getUserRole(u(null))).toBe("user");
	});

	it("returns 'user' for undefined role", () => {
		expect(getUserRole(u(undefined))).toBe("user");
	});

	it("returns 'user' for null user", () => {
		expect(getUserRole(null)).toBe("user");
	});

	it("returns 'user' for undefined user", () => {
		expect(getUserRole(undefined)).toBe("user");
	});
});

describe("userHasPermission()", () => {
	it("grants admin-only permission to a single admin role", () => {
		expect(
			userHasPermission(systemAc, u("admin"), PERMISSIONS.VIEW_ADMIN),
		).toBe(true);
	});

	it("grants admin-only permission for comma-separated 'admin,user'", () => {
		expect(
			userHasPermission(systemAc, u("admin,user"), PERMISSIONS.VIEW_ADMIN),
		).toBe(true);
	});

	it("denies admin-only permission to 'owner' (org-only, not a system role)", () => {
		expect(
			userHasPermission(systemAc, u("owner"), PERMISSIONS.VIEW_ADMIN),
		).toBe(false);
	});

	it("denies admin-only permission to single 'user' role", () => {
		expect(userHasPermission(systemAc, u("user"), PERMISSIONS.VIEW_ADMIN)).toBe(
			false,
		);
	});

	it("denies admin-only permission for null/undefined/empty roles", () => {
		expect(userHasPermission(systemAc, u(null), PERMISSIONS.VIEW_ADMIN)).toBe(
			false,
		);
		expect(
			userHasPermission(systemAc, u(undefined), PERMISSIONS.VIEW_ADMIN),
		).toBe(false);
		expect(userHasPermission(systemAc, u(""), PERMISSIONS.VIEW_ADMIN)).toBe(
			false,
		);
	});

	it("denies admin-only permission for null/undefined user", () => {
		expect(userHasPermission(systemAc, null, PERMISSIONS.VIEW_ADMIN)).toBe(
			false,
		);
		expect(userHasPermission(systemAc, undefined, PERMISSIONS.VIEW_ADMIN)).toBe(
			false,
		);
	});
});
