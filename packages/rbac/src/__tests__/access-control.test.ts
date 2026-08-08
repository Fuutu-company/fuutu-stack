import { describe, expect, it } from "vitest";
import {
	AccessControl,
	type AccessPolicy,
	createResourcePermissions,
	type Permission,
} from "../index";

const posts = createResourcePermissions("posts");
const orgs = createResourcePermissions("orgs");

const policy: AccessPolicy = {
	member: [posts.view, orgs.view],
	admin: [posts.create, posts.update, orgs.create, orgs.update],
	owner: [posts.delete, orgs.delete],
};

const ac = new AccessControl(policy);

describe("AccessControl.can() — every role/permission combination", () => {
	describe("member (only own permissions)", () => {
		it("grants view:posts (direct)", () => {
			expect(ac.can("member", posts.view)).toBe(true);
		});
		it("grants view:orgs (direct)", () => {
			expect(ac.can("member", orgs.view)).toBe(true);
		});
		it("denies create:posts (admin-only, not inherited downward)", () => {
			expect(ac.can("member", posts.create)).toBe(false);
		});
		it("denies update:posts (admin-only, not inherited downward)", () => {
			expect(ac.can("member", posts.update)).toBe(false);
		});
		it("denies delete:posts (owner-only, not inherited downward)", () => {
			expect(ac.can("member", posts.delete)).toBe(false);
		});
	});

	describe("admin (inherits member)", () => {
		it("grants view:posts (inherited from member)", () => {
			expect(ac.can("admin", posts.view)).toBe(true);
		});
		it("grants view:orgs (inherited from member)", () => {
			expect(ac.can("admin", orgs.view)).toBe(true);
		});
		it("grants create:posts (direct)", () => {
			expect(ac.can("admin", posts.create)).toBe(true);
		});
		it("grants update:posts (direct)", () => {
			expect(ac.can("admin", posts.update)).toBe(true);
		});
		it("denies delete:posts (owner-only, not inherited downward)", () => {
			expect(ac.can("admin", posts.delete)).toBe(false);
		});
	});

	describe("owner (inherits member + admin)", () => {
		it("grants view:posts (inherited from member)", () => {
			expect(ac.can("owner", posts.view)).toBe(true);
		});
		it("grants create:posts (inherited from admin)", () => {
			expect(ac.can("owner", posts.create)).toBe(true);
		});
		it("grants update:posts (inherited from admin)", () => {
			expect(ac.can("owner", posts.update)).toBe(true);
		});
		it("grants delete:posts (direct)", () => {
			expect(ac.can("owner", posts.delete)).toBe(true);
		});
	});

	it("denies unknown permission for all roles", () => {
		expect(ac.can("member", "unknown:resource" as Permission)).toBe(false);
		expect(ac.can("admin", "unknown:resource" as Permission)).toBe(false);
		expect(ac.can("owner", "unknown:resource" as Permission)).toBe(false);
	});
});

describe("AccessControl.permissionsFor()", () => {
	it("returns only member permissions for member", () => {
		const perms = ac.permissionsFor("member");
		expect(perms).toContain(posts.view);
		expect(perms).toContain(orgs.view);
		expect(perms).not.toContain(posts.create);
		expect(perms).not.toContain(posts.delete);
		expect(perms.length).toBe(2);
	});

	it("returns member + admin permissions for admin", () => {
		const perms = ac.permissionsFor("admin");
		expect(perms).toContain(posts.view);
		expect(perms).toContain(orgs.view);
		expect(perms).toContain(posts.create);
		expect(perms).toContain(posts.update);
		expect(perms).not.toContain(posts.delete);
		expect(perms.length).toBe(6);
	});

	it("returns all permissions for owner (inherits member + admin)", () => {
		const perms = ac.permissionsFor("owner");
		expect(perms).toContain(posts.view);
		expect(perms).toContain(posts.create);
		expect(perms).toContain(posts.delete);
		expect(perms).toContain(orgs.delete);
		expect(perms.length).toBe(8);
	});

	it("returns empty array for unknown role", () => {
		expect(ac.permissionsFor("unknown" as never)).toEqual([]);
	});

	it("deduplicates permissions", () => {
		const dupPolicy: AccessPolicy = {
			member: [posts.view],
			admin: [posts.view],
			owner: [posts.view],
		};
		const dupAc = new AccessControl(dupPolicy);
		expect(dupAc.permissionsFor("owner")).toEqual([posts.view]);
	});
});

describe("createResourcePermissions()", () => {
	it("generates view permission string", () => {
		expect(posts.view).toBe("view:posts");
	});

	it("generates create permission string", () => {
		expect(posts.create).toBe("create:posts");
	});

	it("generates update permission string", () => {
		expect(posts.update).toBe("update:posts");
	});

	it("generates delete permission string", () => {
		expect(posts.delete).toBe("delete:posts");
	});

	it("works with different resource names", () => {
		const users = createResourcePermissions("users");
		expect(users.view).toBe("view:users");
		expect(users.create).toBe("create:users");
		expect(users.update).toBe("update:users");
		expect(users.delete).toBe("delete:users");
	});
});
