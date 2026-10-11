import { describe, expect, it } from "vitest";
import {
	canCRUD,
	createPermissionChecker,
	createResourcePermissions,
	hasOrgPermission,
	hasSystemPermission,
	OrgAccessControl,
	SystemAccessControl,
	toOrgRole,
	toSystemRole,
} from "../index";

const posts = createResourcePermissions("posts");
const orgs = createResourcePermissions("orgs");

const orgAc = new OrgAccessControl({
	member: [posts.view, orgs.view],
	admin: [posts.create, posts.update, orgs.create, orgs.update],
	owner: [posts.delete, orgs.delete],
});

const systemAc = new SystemAccessControl({
	user: [posts.view],
	admin: [posts.create, posts.update],
});

describe("hasOrgPermission()", () => {
	it("returns true when role has the permission directly", () => {
		expect(hasOrgPermission(orgAc, "member", posts.view)).toBe(true);
	});

	it("returns true when role inherits the permission (owner inherits member)", () => {
		expect(hasOrgPermission(orgAc, "owner", posts.view)).toBe(true);
		expect(hasOrgPermission(orgAc, "admin", posts.view)).toBe(true);
	});

	it("returns false when role lacks the permission (member does not inherit owner)", () => {
		expect(hasOrgPermission(orgAc, "member", posts.delete)).toBe(false);
		expect(hasOrgPermission(orgAc, "member", posts.create)).toBe(false);
	});

	it("returns false for null role", () => {
		expect(hasOrgPermission(orgAc, null, posts.view)).toBe(false);
	});

	it("returns false for undefined role", () => {
		expect(hasOrgPermission(orgAc, undefined, posts.view)).toBe(false);
	});

	it("owner inherits all permissions from member and admin", () => {
		expect(hasOrgPermission(orgAc, "owner", posts.view)).toBe(true);
		expect(hasOrgPermission(orgAc, "owner", posts.create)).toBe(true);
		expect(hasOrgPermission(orgAc, "owner", posts.delete)).toBe(true);
	});

	it("admin inherits from member but not owner", () => {
		expect(hasOrgPermission(orgAc, "admin", posts.view)).toBe(true);
		expect(hasOrgPermission(orgAc, "admin", posts.create)).toBe(true);
		expect(hasOrgPermission(orgAc, "admin", posts.delete)).toBe(false);
	});
});

describe("hasSystemPermission()", () => {
	it("user has view", () => {
		expect(hasSystemPermission(systemAc, "user", posts.view)).toBe(true);
	});

	it("admin inherits user view", () => {
		expect(hasSystemPermission(systemAc, "admin", posts.view)).toBe(true);
	});

	it("admin has create directly", () => {
		expect(hasSystemPermission(systemAc, "admin", posts.create)).toBe(true);
	});

	it("user cannot create", () => {
		expect(hasSystemPermission(systemAc, "user", posts.create)).toBe(false);
	});

	it("returns false for null role", () => {
		expect(hasSystemPermission(systemAc, null, posts.view)).toBe(false);
	});
});

describe("canCRUD()", () => {
	it("returns only view for member (no inheritance upward)", () => {
		const result = canCRUD(orgAc, "member", "posts");
		expect(result).toEqual({
			view: true,
			create: false,
			update: false,
			delete: false,
		});
	});

	it("returns view+create+update for admin (inherits member, not owner)", () => {
		const result = canCRUD(orgAc, "admin", "posts");
		expect(result).toEqual({
			view: true,
			create: true,
			update: true,
			delete: false,
		});
	});

	it("returns all CRUD for owner (inherits member + admin)", () => {
		const result = canCRUD(orgAc, "owner", "posts");
		expect(result).toEqual({
			view: true,
			create: true,
			update: true,
			delete: true,
		});
	});

	it("returns all false for null role", () => {
		const result = canCRUD(orgAc, null, "posts");
		expect(result).toEqual({
			view: false,
			create: false,
			update: false,
			delete: false,
		});
	});
});

describe("createPermissionChecker()", () => {
	it("exposes the bound role", () => {
		const checker = createPermissionChecker(orgAc, "admin");
		expect(checker.role).toBe("admin");
	});

	it("can() delegates to hasPermission", () => {
		const checker = createPermissionChecker(orgAc, "owner");
		expect(checker.can(posts.view)).toBe(true);
		expect(checker.can(posts.delete)).toBe(true);
		expect(checker.can("unknown:perm" as never)).toBe(false);
	});

	it("canAny() returns true if any permission is granted", () => {
		const checker = createPermissionChecker(orgAc, "owner");
		expect(checker.canAny([posts.view, "unknown:perm" as never])).toBe(true);
	});

	it("canAny() returns false if no permission is granted", () => {
		const checker = createPermissionChecker(orgAc, "member");
		expect(checker.canAny([posts.create, posts.delete])).toBe(false);
	});

	it("canAll() returns true when all permissions are granted", () => {
		const checker = createPermissionChecker(orgAc, "owner");
		expect(checker.canAll([posts.view, posts.create, posts.delete])).toBe(true);
	});

	it("canAll() returns false when any permission is missing", () => {
		const checker = createPermissionChecker(orgAc, "member");
		expect(checker.canAll([posts.view, posts.delete])).toBe(false);
	});

	it("works with null role — all checks return false", () => {
		const checker = createPermissionChecker(orgAc, null);
		expect(checker.role).toBeNull();
		expect(checker.can(posts.view)).toBe(false);
		expect(checker.canAny([posts.view])).toBe(false);
		expect(checker.canAll([posts.view])).toBe(false);
	});
});

describe("edge cases", () => {
	it("resource with only view permission on member — admin and owner inherit view", () => {
		const viewOnlyAc = new OrgAccessControl({
			member: [posts.view],
			admin: [],
			owner: [],
		});
		expect(canCRUD(viewOnlyAc, "member", "posts")).toEqual({
			view: true,
			create: false,
			update: false,
			delete: false,
		});
		expect(canCRUD(viewOnlyAc, "admin", "posts")).toEqual({
			view: true,
			create: false,
			update: false,
			delete: false,
		});
		expect(canCRUD(viewOnlyAc, "owner", "posts")).toEqual({
			view: true,
			create: false,
			update: false,
			delete: false,
		});
	});

	it("resource with all CRUD on owner only — only owner has all", () => {
		const allCrudAc = new OrgAccessControl({
			member: [],
			admin: [],
			owner: [posts.view, posts.create, posts.update, posts.delete],
		});
		expect(canCRUD(allCrudAc, "member", "posts")).toEqual({
			view: false,
			create: false,
			update: false,
			delete: false,
		});
		expect(canCRUD(allCrudAc, "admin", "posts")).toEqual({
			view: false,
			create: false,
			update: false,
			delete: false,
		});
		expect(canCRUD(allCrudAc, "owner", "posts")).toEqual({
			view: true,
			create: true,
			update: true,
			delete: true,
		});
	});

	it("empty permissions for all roles", () => {
		const emptyAc = new OrgAccessControl<string>({
			member: [],
			admin: [],
			owner: [],
		});
		expect(emptyAc.can("owner", posts.view)).toBe(false);
		expect(emptyAc.permissionsFor("owner")).toEqual([]);
		expect(emptyAc.permissionsFor("member")).toEqual([]);
	});
});

describe("toSystemRole()", () => {
	it("returns admin when admin is present", () => {
		expect(toSystemRole("admin,user")).toBe("admin");
	});

	it("returns user for an empty string", () => {
		expect(toSystemRole("")).toBe("user");
	});

	it("returns user for null", () => {
		expect(toSystemRole(null)).toBe("user");
	});

	it("returns user for undefined", () => {
		expect(toSystemRole(undefined)).toBe("user");
	});

	it("returns user for an unknown role", () => {
		expect(toSystemRole("superuser")).toBe("user");
	});

	it("is case-sensitive — 'Admin' does not match 'admin'", () => {
		expect(toSystemRole("Admin")).toBe("user");
	});

	it("returns the role for a single known role", () => {
		expect(toSystemRole("admin")).toBe("admin");
	});

	it("trims whitespace around roles before matching", () => {
		expect(toSystemRole("  admin , user ")).toBe("admin");
	});

	it("ignores owner — system has no owner", () => {
		expect(toSystemRole("owner")).toBe("user");
	});
});

describe("toOrgRole()", () => {
	it("returns owner when owner is present alongside other roles", () => {
		expect(toOrgRole("user,owner")).toBe("owner");
	});

	it("returns admin when admin is present (no owner)", () => {
		expect(toOrgRole("admin,user")).toBe("admin");
	});

	it("returns member for an empty string", () => {
		expect(toOrgRole("")).toBe("member");
	});

	it("returns member for null", () => {
		expect(toOrgRole(null)).toBe("member");
	});

	it("returns member for undefined", () => {
		expect(toOrgRole(undefined)).toBe("member");
	});

	it("returns member for an unknown role", () => {
		expect(toOrgRole("superuser")).toBe("member");
	});

	it("returns owner when owner appears after admin in the list", () => {
		expect(toOrgRole("admin,owner")).toBe("owner");
	});
});
