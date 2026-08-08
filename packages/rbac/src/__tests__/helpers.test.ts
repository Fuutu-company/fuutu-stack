import { describe, expect, it } from "vitest";
import {
	AccessControl,
	canCRUD,
	createPermissionChecker,
	createResourcePermissions,
	hasPermission,
	toRbacRole,
} from "../index";

const posts = createResourcePermissions("posts");
const orgs = createResourcePermissions("orgs");

const ac = new AccessControl({
	member: [posts.view, orgs.view],
	admin: [posts.create, posts.update, orgs.create, orgs.update],
	owner: [posts.delete, orgs.delete],
});

describe("hasPermission()", () => {
	it("returns true when role has the permission directly", () => {
		expect(hasPermission(ac, "member", posts.view)).toBe(true);
	});

	it("returns true when role inherits the permission (owner inherits member)", () => {
		expect(hasPermission(ac, "owner", posts.view)).toBe(true);
		expect(hasPermission(ac, "admin", posts.view)).toBe(true);
	});

	it("returns false when role lacks the permission (member does not inherit owner)", () => {
		expect(hasPermission(ac, "member", posts.delete)).toBe(false);
		expect(hasPermission(ac, "member", posts.create)).toBe(false);
	});

	it("returns false for null role", () => {
		expect(hasPermission(ac, null, posts.view)).toBe(false);
	});

	it("returns false for undefined role", () => {
		expect(hasPermission(ac, undefined, posts.view)).toBe(false);
	});

	it("owner inherits all permissions from member and admin", () => {
		expect(hasPermission(ac, "owner", posts.view)).toBe(true);
		expect(hasPermission(ac, "owner", posts.create)).toBe(true);
		expect(hasPermission(ac, "owner", posts.delete)).toBe(true);
	});

	it("admin inherits from member but not owner", () => {
		expect(hasPermission(ac, "admin", posts.view)).toBe(true);
		expect(hasPermission(ac, "admin", posts.create)).toBe(true);
		expect(hasPermission(ac, "admin", posts.delete)).toBe(false);
	});
});

describe("canCRUD()", () => {
	it("returns only view for member (no inheritance upward)", () => {
		const result = canCRUD(ac, "member", "posts");
		expect(result).toEqual({
			view: true,
			create: false,
			update: false,
			delete: false,
		});
	});

	it("returns view+create+update for admin (inherits member, not owner)", () => {
		const result = canCRUD(ac, "admin", "posts");
		expect(result).toEqual({
			view: true,
			create: true,
			update: true,
			delete: false,
		});
	});

	it("returns all CRUD for owner (inherits member + admin)", () => {
		const result = canCRUD(ac, "owner", "posts");
		expect(result).toEqual({
			view: true,
			create: true,
			update: true,
			delete: true,
		});
	});

	it("returns all false for null role", () => {
		const result = canCRUD(ac, null, "posts");
		expect(result).toEqual({
			view: false,
			create: false,
			update: false,
			delete: false,
		});
	});

	it("returns all false for undefined role", () => {
		const result = canCRUD(ac, undefined, "posts");
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
		const checker = createPermissionChecker(ac, "admin");
		expect(checker.role).toBe("admin");
	});

	it("can() delegates to hasPermission", () => {
		const checker = createPermissionChecker(ac, "owner");
		expect(checker.can(posts.view)).toBe(true);
		expect(checker.can(posts.delete)).toBe(true);
		expect(checker.can("unknown:perm" as never)).toBe(false);
	});

	it("canAny() returns true if any permission is granted", () => {
		const checker = createPermissionChecker(ac, "owner");
		expect(checker.canAny([posts.view, "unknown:perm" as never])).toBe(true);
	});

	it("canAny() returns false if no permission is granted", () => {
		const checker = createPermissionChecker(ac, "member");
		expect(checker.canAny([posts.create, posts.delete])).toBe(false);
	});

	it("canAll() returns true when all permissions are granted", () => {
		const checker = createPermissionChecker(ac, "owner");
		expect(checker.canAll([posts.view, posts.create, posts.delete])).toBe(true);
	});

	it("canAll() returns false when any permission is missing", () => {
		const checker = createPermissionChecker(ac, "member");
		expect(checker.canAll([posts.view, posts.delete])).toBe(false);
	});

	it("works with null role — all checks return false", () => {
		const checker = createPermissionChecker(ac, null);
		expect(checker.role).toBeNull();
		expect(checker.can(posts.view)).toBe(false);
		expect(checker.canAny([posts.view])).toBe(false);
		expect(checker.canAll([posts.view])).toBe(false);
	});
});

describe("edge cases", () => {
	it("resource with only view permission on member — admin and owner inherit view", () => {
		const viewOnlyAc = new AccessControl({
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
		const allCrudAc = new AccessControl({
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
		const emptyAc = new AccessControl<string>({
			member: [],
			admin: [],
			owner: [],
		});
		expect(emptyAc.can("owner", posts.view)).toBe(false);
		expect(emptyAc.permissionsFor("owner")).toEqual([]);
		expect(emptyAc.permissionsFor("member")).toEqual([]);
	});
});

describe("toRbacRole()", () => {
	it("returns the highest matching role from a comma-separated string", () => {
		expect(toRbacRole("admin,user")).toBe("admin");
	});

	it("returns owner when owner is present alongside other roles", () => {
		expect(toRbacRole("user,owner")).toBe("owner");
	});

	it("returns member for an empty string", () => {
		expect(toRbacRole("")).toBe("member");
	});

	it("returns member for null", () => {
		expect(toRbacRole(null)).toBe("member");
	});

	it("returns member for undefined", () => {
		expect(toRbacRole(undefined)).toBe("member");
	});

	it("returns member for a whitespace-only string", () => {
		expect(toRbacRole("   ")).toBe("member");
	});

	it("returns member for an unknown role", () => {
		expect(toRbacRole("superuser")).toBe("member");
	});

	it("is case-sensitive — 'Admin' does not match 'admin'", () => {
		expect(toRbacRole("Admin")).toBe("member");
	});

	it("returns the role for a single known role", () => {
		expect(toRbacRole("admin")).toBe("admin");
	});

	it("returns the highest known role from a mixed known/unknown list", () => {
		expect(toRbacRole("admin,superuser")).toBe("admin");
	});

	it("trims whitespace around roles before matching", () => {
		expect(toRbacRole("  admin , user ")).toBe("admin");
	});

	it("returns owner when owner appears after admin in the list", () => {
		expect(toRbacRole("admin,owner")).toBe("owner");
	});
});
