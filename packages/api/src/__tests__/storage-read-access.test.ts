import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Per-object read authorization behind `/image-proxy`: an owner-only
 * bucket's object is readable when its first key segment is the viewer's
 * user id, or an org the viewer belongs to with STORAGE.VIEW, or by a
 * system admin with ADMIN_ORGANIZATION.VIEW. A "signed-in" bucket is
 * readable by everyone signed in.
 */

const mocks = vi.hoisted(() => ({
	getOrganizationMemberRole: vi.fn(),
	readAccess: {
		avatars: "signed-in",
		"organization-logos": "owner",
	} as Record<string, string>,
}));

vi.mock("@fuutu/db", () => ({
	getOrganizationMemberRole: mocks.getOrganizationMemberRole,
}));
vi.mock("@fuutu/storage", () => ({
	resolveBucketReadAccess: (alias: string) => {
		const access = mocks.readAccess[alias];
		if (!access) throw new Error(`unknown alias ${alias}`);
		return access;
	},
}));

const { canReadStorageObject } = await import("../modules/storage/read-access");

const viewer = { id: "user-1", role: "user" };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.getOrganizationMemberRole.mockResolvedValue(null);
});

describe("canReadStorageObject", () => {
	it("lets a user read their own object", async () => {
		expect(
			await canReadStorageObject({
				alias: "organization-logos",
				key: "user-1/logo.png",
				user: viewer,
			}),
		).toBe(true);
	});

	it("lets an org member read the org's object", async () => {
		mocks.getOrganizationMemberRole.mockResolvedValue("member");
		expect(
			await canReadStorageObject({
				alias: "organization-logos",
				key: "org-1/logo-abc.png",
				user: viewer,
			}),
		).toBe(true);
		expect(mocks.getOrganizationMemberRole).toHaveBeenCalledWith(
			"org-1",
			"user-1",
		);
	});

	it("denies another org's object to a non-member", async () => {
		expect(
			await canReadStorageObject({
				alias: "organization-logos",
				key: "org-2/logo.png",
				user: viewer,
			}),
		).toBe(false);
	});

	it("denies another user's object", async () => {
		expect(
			await canReadStorageObject({
				alias: "organization-logos",
				key: "user-2/logo.png",
				user: viewer,
			}),
		).toBe(false);
	});

	it("lets a system admin read any org's object (support views)", async () => {
		expect(
			await canReadStorageObject({
				alias: "organization-logos",
				key: "org-2/logo.png",
				user: { id: "admin-1", role: "admin" },
			}),
		).toBe(true);
	});

	it("lets anyone signed in read a bucket that opted in", async () => {
		expect(
			await canReadStorageObject({
				alias: "avatars",
				key: "user-2/me.png",
				user: viewer,
			}),
		).toBe(true);
		expect(mocks.getOrganizationMemberRole).not.toHaveBeenCalled();
	});

	it("denies an unknown bucket alias", async () => {
		expect(
			await canReadStorageObject({
				alias: "secrets",
				key: "user-1/x.png",
				user: viewer,
			}),
		).toBe(false);
	});
});
