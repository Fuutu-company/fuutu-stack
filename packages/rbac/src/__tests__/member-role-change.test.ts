import { describe, expect, it } from "vitest";
import { assignableOrgRoles, canChangeMemberRole } from "../index";

describe("canChangeMemberRole()", () => {
	it("lets an owner move another member to any role", () => {
		expect(canChangeMemberRole("owner", "member", "owner")).toBe(true);
		expect(canChangeMemberRole("owner", "owner", "admin")).toBe(true);
		expect(canChangeMemberRole("owner", "admin", "member")).toBe(true);
	});

	it("lets an admin move a member between member and admin", () => {
		expect(canChangeMemberRole("admin", "member", "admin")).toBe(true);
	});

	it("never lets an admin assign owner", () => {
		expect(canChangeMemberRole("admin", "member", "owner")).toBe(false);
	});

	it("never lets an admin change an admin or an owner", () => {
		expect(canChangeMemberRole("admin", "admin", "member")).toBe(false);
		expect(canChangeMemberRole("admin", "owner", "member")).toBe(false);
	});

	it("never lets a member change roles", () => {
		expect(canChangeMemberRole("member", "member", "member")).toBe(false);
	});
});

describe("assignableOrgRoles()", () => {
	it("offers every role to an owner, highest first", () => {
		expect(assignableOrgRoles("owner")).toEqual(["owner", "admin", "member"]);
	});

	it("offers admin and member to an admin", () => {
		expect(assignableOrgRoles("admin")).toEqual(["admin", "member"]);
	});
});
