import { describe, expect, it } from "vitest";
import {
	AccessControl,
	CRUD_ACTIONS,
	createResourcePermissions,
	hasRoleAtLeast,
	ROLE_HIERARCHY,
	type Role,
} from "../index";

describe("ROLE_HIERARCHY", () => {
	it("has exactly three roles in order: member < admin < owner", () => {
		expect(ROLE_HIERARCHY).toEqual(["member", "admin", "owner"]);
	});
});

describe("hasRoleAtLeast()", () => {
	it("member is at least member", () => {
		expect(hasRoleAtLeast("member", "member")).toBe(true);
	});

	it("member is not at least admin", () => {
		expect(hasRoleAtLeast("member", "admin")).toBe(false);
	});

	it("member is not at least owner", () => {
		expect(hasRoleAtLeast("member", "owner")).toBe(false);
	});

	it("admin is at least member", () => {
		expect(hasRoleAtLeast("admin", "member")).toBe(true);
	});

	it("admin is at least admin", () => {
		expect(hasRoleAtLeast("admin", "admin")).toBe(true);
	});

	it("admin is not at least owner", () => {
		expect(hasRoleAtLeast("admin", "owner")).toBe(false);
	});

	it("owner is at least member", () => {
		expect(hasRoleAtLeast("owner", "member")).toBe(true);
	});

	it("owner is at least admin", () => {
		expect(hasRoleAtLeast("owner", "admin")).toBe(true);
	});

	it("owner is at least owner", () => {
		expect(hasRoleAtLeast("owner", "owner")).toBe(true);
	});
});

describe("AccessControl inheritance via can()", () => {
	const posts = createResourcePermissions("posts");

	const ac = new AccessControl({
		member: [posts.view],
		admin: [posts.create, posts.update],
		owner: [posts.delete],
	});

	it("member has only its own permissions", () => {
		expect(ac.can("member", posts.view)).toBe(true);
		expect(ac.can("member", posts.create)).toBe(false);
		expect(ac.can("member", posts.update)).toBe(false);
		expect(ac.can("member", posts.delete)).toBe(false);
	});

	it("admin inherits from member but not from owner", () => {
		expect(ac.can("admin", posts.view)).toBe(true);
		expect(ac.can("admin", posts.create)).toBe(true);
		expect(ac.can("admin", posts.update)).toBe(true);
		expect(ac.can("admin", posts.delete)).toBe(false);
	});

	it("owner inherits all permissions from member and admin", () => {
		expect(ac.can("owner", posts.view)).toBe(true);
		expect(ac.can("owner", posts.create)).toBe(true);
		expect(ac.can("owner", posts.update)).toBe(true);
		expect(ac.can("owner", posts.delete)).toBe(true);
	});

	it("permissionsFor accumulates from member up to current role", () => {
		expect(ac.permissionsFor("member").length).toBe(1);
		expect(ac.permissionsFor("admin").length).toBe(3);
		expect(ac.permissionsFor("owner").length).toBe(4);
	});
});

describe("CRUD_ACTIONS", () => {
	it("contains view, create, update, delete in order", () => {
		expect(CRUD_ACTIONS).toEqual(["view", "create", "update", "delete"]);
	});
});

describe("unknown role edge case", () => {
	it("can() returns false for unknown role", () => {
		const posts = createResourcePermissions("posts");
		const ac = new AccessControl({
			member: [posts.view],
			admin: [posts.create],
			owner: [posts.delete],
		});
		expect(ac.can("superadmin" as Role, posts.view)).toBe(false);
	});

	it("permissionsFor() returns empty array for unknown role", () => {
		const posts = createResourcePermissions("posts");
		const ac = new AccessControl({
			member: [posts.view],
			admin: [posts.create],
			owner: [posts.delete],
		});
		expect(ac.permissionsFor("superadmin" as Role)).toEqual([]);
	});
});
