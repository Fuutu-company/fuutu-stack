import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		$transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
		oauthAccessToken: { deleteMany: vi.fn() },
		oauthRefreshToken: { deleteMany: vi.fn(), updateMany: vi.fn() },
	},
}));

const { db } = await import("../../prisma/client");
const { revokeDesktopDevice } = await import(
	"../../prisma/queries/desktop-oauth"
);

describe("revokeDesktopDevice", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(db.oauthAccessToken.deleteMany).mockResolvedValue({
			count: 1,
		} as never);
	});

	// Marking the head `revoked` makes Better Auth see the device's next
	// refresh as token reuse and invalidate ALL the user's desktop devices.
	it("deletes the current head instead of marking it revoked", async () => {
		vi.mocked(db.oauthRefreshToken.deleteMany).mockResolvedValue({
			count: 1,
		} as never);
		await expect(revokeDesktopDevice("u1", "c1", "rt1")).resolves.toBe(true);
		expect(db.oauthRefreshToken.deleteMany).toHaveBeenCalledWith({
			where: {
				id: "rt1",
				userId: "u1",
				clientId: "c1",
				revoked: null,
				rotatedAt: null,
			},
		});
		expect(db.oauthRefreshToken.updateMany).not.toHaveBeenCalled();
	});

	it("reports a stale, foreign or unknown id as not found", async () => {
		vi.mocked(db.oauthRefreshToken.deleteMany).mockResolvedValue({
			count: 0,
		} as never);
		await expect(revokeDesktopDevice("u1", "c1", "old")).resolves.toBe(false);
	});
});
