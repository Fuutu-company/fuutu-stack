import { describe, expect, it } from "vitest";
import {
	createResourcePermissions,
	OrgAccessControl,
	type OrgAccessPolicy,
	type OrgRole,
	type Permission,
	SystemAccessControl,
	type SystemAccessPolicy,
	type SystemRole,
} from "../index";

const posts = createResourcePermissions("posts");
const orgs = createResourcePermissions("orgs");

const policy: OrgAccessPolicy = {
	member: [posts.view, orgs.view],
	admin: [posts.create, posts.update, orgs.create, orgs.update],
	owner: [posts.delete, orgs.delete],
};

const ac = new OrgAccessControl(policy);

describe("OrgAccessControl.can() — every role/permission combination", () => {
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

describe("OrgAccessControl.permissionsFor()", () => {
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

	it("deduplicates permissions", () => {
		const dupAc = new OrgAccessControl({
			member: [posts.view],
			admin: [posts.view],
			owner: [posts.view],
		});
		expect(dupAc.permissionsFor("owner")).toEqual([posts.view]);
	});
});

describe("adversarial roles and malformed policies", () => {
	const sysAc = new SystemAccessControl({
		user: [posts.view],
		admin: [posts.create, posts.update],
	});

	it("denies an unknown role in OrgAccessControl", () => {
		expect(ac.can("superuser" as OrgRole, posts.view)).toBe(false);
	});

	it("denies an unknown role in SystemAccessControl", () => {
		expect(sysAc.can("superuser" as SystemRole, posts.view)).toBe(false);
	});

	it("denies an org role in SystemAccessControl (no cross-system leak)", () => {
		expect(sysAc.can("owner" as SystemRole, posts.view)).toBe(false);
	});

	it("denies a system role in OrgAccessControl (no cross-system leak)", () => {
		expect(ac.can("user" as OrgRole, posts.view)).toBe(false);
	});

	it("can() returns false when the policy is missing a role key (system)", () => {
		const malformed: Partial<SystemAccessPolicy> = { user: [posts.view] };
		const partial = new SystemAccessControl(malformed as SystemAccessPolicy);
		expect(partial.can("admin", posts.create)).toBe(false);
	});

	it("permissionsFor() does not throw when the policy is missing a role key (system)", () => {
		const malformed: Partial<SystemAccessPolicy> = { user: [posts.view] };
		const partial = new SystemAccessControl(malformed as SystemAccessPolicy);
		expect(() => partial.permissionsFor("admin")).not.toThrow();
		expect(partial.permissionsFor("admin")).toEqual([posts.view]);
	});

	it("can() returns false when the policy is missing a role key (org)", () => {
		const malformed: Partial<OrgAccessPolicy> = {
			member: [posts.view],
			admin: [posts.create],
		};
		const partial = new OrgAccessControl(malformed as OrgAccessPolicy);
		expect(partial.can("owner", posts.delete)).toBe(false);
		expect(partial.can("owner", posts.view)).toBe(true);
	});

	it("permissionsFor() does not throw when the policy is missing a role key (org)", () => {
		const malformed: Partial<OrgAccessPolicy> = {
			member: [posts.view],
			admin: [posts.create],
		};
		const partial = new OrgAccessControl(malformed as OrgAccessPolicy);
		expect(() => partial.permissionsFor("owner")).not.toThrow();
		expect(partial.permissionsFor("owner")).toEqual([posts.view, posts.create]);
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
