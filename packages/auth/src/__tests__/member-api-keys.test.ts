import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	revokeOrgApiKeysForUser: vi.fn(),
}));

const { revokeOrgApiKeysForUser } = await import("@fuutu/db");
const { revokeApiKeysOfRemovedMember, revokeApiKeysAfterLeave } = await import(
	"../hooks/member-api-keys"
);

beforeEach(() => {
	vi.mocked(revokeOrgApiKeysForUser).mockReset();
	vi.mocked(revokeOrgApiKeysForUser).mockResolvedValue(1);
});

describe("revokeApiKeysOfRemovedMember (beforeRemoveMember)", () => {
	it("revokes the removed user's keys for that organization", async () => {
		await revokeApiKeysOfRemovedMember({
			organizationId: "org-1",
			userId: "user-2",
		});
		expect(revokeOrgApiKeysForUser).toHaveBeenCalledWith("org-1", "user-2");
	});

	it("propagates a failed revoke so the removal is aborted (fail closed)", async () => {
		vi.mocked(revokeOrgApiKeysForUser).mockRejectedValue(new Error("db down"));
		await expect(
			revokeApiKeysOfRemovedMember({
				organizationId: "org-1",
				userId: "user-2",
			}),
		).rejects.toThrow("db down");
	});
});

describe("revokeApiKeysAfterLeave (hooks.after)", () => {
	it("revokes the leaving user's keys for that organization", async () => {
		await revokeApiKeysAfterLeave({
			path: "/organization/leave",
			returned: { id: "member-2" },
			body: { organizationId: "org-1" },
			userId: "user-2",
		});
		expect(revokeOrgApiKeysForUser).toHaveBeenCalledWith("org-1", "user-2");
	});

	it("keeps keys when leaving failed (e.g. the only owner)", async () => {
		await revokeApiKeysAfterLeave({
			path: "/organization/leave",
			returned: new APIError("BAD_REQUEST"),
			body: { organizationId: "org-1" },
			userId: "user-2",
		});
		expect(revokeOrgApiKeysForUser).not.toHaveBeenCalled();
	});

	it("ignores other endpoints and requests without user or organization", async () => {
		await revokeApiKeysAfterLeave({
			path: "/organization/update",
			returned: {},
			body: { organizationId: "org-1" },
			userId: "user-2",
		});
		await revokeApiKeysAfterLeave({
			path: "/organization/leave",
			returned: {},
			body: {},
			userId: "user-2",
		});
		await revokeApiKeysAfterLeave({
			path: "/organization/leave",
			returned: {},
			body: { organizationId: "org-1" },
			userId: undefined,
		});
		expect(revokeOrgApiKeysForUser).not.toHaveBeenCalled();
	});
});
