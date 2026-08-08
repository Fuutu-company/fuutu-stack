import { describe, expect, it } from "vitest";
import { getUserRole, isAdmin, type UserWithRole } from "../types";

/** Minimal valid user shape for type checking. */
function u(role: string | null | undefined): UserWithRole {
	return {
		id: "test-id",
		email: "test@fuutu.local",
		name: "Test User",
		role,
	};
}

describe("getUserRole()", () => {
	it("returns 'admin' for single admin role", () => {
		expect(getUserRole(u("admin"))).toBe("admin");
	});

	it("returns 'admin' for comma-separated 'admin,user' (multi-role bug case)", () => {
		expect(getUserRole(u("admin,user"))).toBe("admin");
	});

	it("returns 'owner' when owner is in the list", () => {
		expect(getUserRole(u("admin,owner"))).toBe("owner");
	});

	it("returns 'member' for single 'user' role", () => {
		expect(getUserRole(u("user"))).toBe("member");
	});

	it("returns 'member' for empty string", () => {
		expect(getUserRole(u(""))).toBe("member");
	});

	it("returns 'member' for null role", () => {
		expect(getUserRole(u(null))).toBe("member");
	});

	it("returns 'member' for undefined role", () => {
		expect(getUserRole(u(undefined))).toBe("member");
	});

	it("returns 'member' for null user", () => {
		expect(getUserRole(null)).toBe("member");
	});

	it("returns 'member' for undefined user", () => {
		expect(getUserRole(undefined)).toBe("member");
	});
});

describe("isAdmin()", () => {
	it("returns true for single admin role", () => {
		expect(isAdmin(u("admin"))).toBe(true);
	});

	it("returns true for comma-separated 'admin,user' (multi-role bug case)", () => {
		expect(isAdmin(u("admin,user"))).toBe(true);
	});

	it("returns true for owner role (inherits admin)", () => {
		expect(isAdmin(u("owner"))).toBe(true);
	});

	it("returns false for single 'user' role", () => {
		expect(isAdmin(u("user"))).toBe(false);
	});

	it("returns false for null role", () => {
		expect(isAdmin(u(null))).toBe(false);
	});

	it("returns false for undefined role", () => {
		expect(isAdmin(u(undefined))).toBe(false);
	});

	it("returns false for empty string role", () => {
		expect(isAdmin(u(""))).toBe(false);
	});

	it("returns false for null user", () => {
		expect(isAdmin(null)).toBe(false);
	});

	it("returns false for undefined user", () => {
		expect(isAdmin(undefined)).toBe(false);
	});
});
