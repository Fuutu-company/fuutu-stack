import { describe, expect, it } from "vitest";
import { AccessControl, hasPermission } from "../index";
import { DEFAULT_ACCESS_POLICY, PERMISSIONS } from "../policy";

describe("DEFAULT_ACCESS_POLICY", () => {
	const ac = new AccessControl(DEFAULT_ACCESS_POLICY);

	it("member can view api-keys", () => {
		expect(hasPermission(ac, "member", "view:api-key")).toBe(true);
	});
	it("member cannot view admin", () => {
		expect(hasPermission(ac, "member", PERMISSIONS.VIEW_ADMIN)).toBe(false);
	});
	it("admin can view admin", () => {
		expect(hasPermission(ac, "admin", PERMISSIONS.VIEW_ADMIN)).toBe(true);
	});
	it("admin inherits member permissions", () => {
		expect(hasPermission(ac, "admin", "view:api-key")).toBe(true);
	});
	it("owner can manage billing", () => {
		expect(hasPermission(ac, "owner", PERMISSIONS.MANAGE_BILLING)).toBe(true);
	});
	it("owner inherits admin permissions", () => {
		expect(hasPermission(ac, "owner", PERMISSIONS.VIEW_ADMIN)).toBe(true);
	});
	it("member can use ai", () => {
		expect(hasPermission(ac, "member", PERMISSIONS.USE_AI)).toBe(true);
	});
});
