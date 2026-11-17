import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

const countOrganizationOwners = vi.fn();
const adminSetOrganizationMemberRole = vi.fn();

vi.mock("@fuutu/db", () => ({
	countOrganizationOwners: (...args: unknown[]) =>
		countOrganizationOwners(...args),
	adminSetOrganizationMemberRole: (...args: unknown[]) =>
		adminSetOrganizationMemberRole(...args),
}));

const {
	assertOwnerRemainsAfterRoleChange,
	assertOwnerRemainsAfterRemoval,
	restoreOwnerIfNoneLeft,
} = await import("../hooks/last-owner");

const owner = { id: "m-1", organizationId: "org-1", role: "owner" };
const admin = { id: "m-2", organizationId: "org-1", role: "admin" };

beforeEach(() => {
	vi.clearAllMocks();
	adminSetOrganizationMemberRole.mockResolvedValue({ status: "updated" });
});

describe("assertOwnerRemainsAfterRoleChange", () => {
	it("refuses demoting the only owner", async () => {
		countOrganizationOwners.mockResolvedValue(1);
		const error = await assertOwnerRemainsAfterRoleChange({
			member: owner,
			newRole: "admin",
		}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(APIError);
		expect(error).toMatchObject({
			statusCode: 400,
			body: { code: "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER" },
		});
		expect(countOrganizationOwners).toHaveBeenCalledWith("org-1");
	});

	it("allows demoting one of two owners", async () => {
		countOrganizationOwners.mockResolvedValue(2);
		await expect(
			assertOwnerRemainsAfterRoleChange({ member: owner, newRole: "member" }),
		).resolves.toBeUndefined();
	});

	it("allows a change that keeps the owner role", async () => {
		countOrganizationOwners.mockResolvedValue(1);
		await expect(
			assertOwnerRemainsAfterRoleChange({
				member: owner,
				newRole: "owner,admin",
			}),
		).resolves.toBeUndefined();
	});

	it("does not count owners for a non-owner", async () => {
		await assertOwnerRemainsAfterRoleChange({
			member: admin,
			newRole: "member",
		});
		expect(countOrganizationOwners).not.toHaveBeenCalled();
	});
});

describe("assertOwnerRemainsAfterRemoval", () => {
	it("refuses removing the only owner", async () => {
		countOrganizationOwners.mockResolvedValue(1);
		await expect(
			assertOwnerRemainsAfterRemoval({ member: owner }),
		).rejects.toBeInstanceOf(APIError);
	});

	it("allows removing one of two owners or a non-owner", async () => {
		countOrganizationOwners.mockResolvedValue(2);
		await expect(
			assertOwnerRemainsAfterRemoval({ member: owner }),
		).resolves.toBeUndefined();
		await expect(
			assertOwnerRemainsAfterRemoval({ member: admin }),
		).resolves.toBeUndefined();
	});
});

describe("restoreOwnerIfNoneLeft (concurrent demotions)", () => {
	it("makes the demoted member owner again when no owner is left and fails the change", async () => {
		countOrganizationOwners.mockResolvedValue(0);
		const error = await restoreOwnerIfNoneLeft({
			member: { ...owner, role: "admin" },
			previousRole: "owner",
		}).catch((e: unknown) => e);
		expect(adminSetOrganizationMemberRole).toHaveBeenCalledWith({
			organizationId: "org-1",
			memberId: "m-1",
			role: "owner",
		});
		expect(error).toBeInstanceOf(APIError);
	});

	it("leaves the change alone while an owner remains", async () => {
		countOrganizationOwners.mockResolvedValue(1);
		await expect(
			restoreOwnerIfNoneLeft({
				member: { ...owner, role: "admin" },
				previousRole: "owner",
			}),
		).resolves.toBeUndefined();
		expect(adminSetOrganizationMemberRole).not.toHaveBeenCalled();
	});

	it("ignores members that were not owners before", async () => {
		await restoreOwnerIfNoneLeft({ member: admin, previousRole: "member" });
		expect(countOrganizationOwners).not.toHaveBeenCalled();
	});
});
