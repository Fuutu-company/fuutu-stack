import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	persistActiveOrganizationChange,
	restoreActiveOrganization,
} from "../hooks/active-organization";

const getUserById = vi.fn();
const isOrganizationMember = vi.fn();
const setLastActiveOrganization = vi.fn();

vi.mock("@fuutu/db", () => ({
	getUserById: (...args: unknown[]) => getUserById(...args),
	isOrganizationMember: (...args: unknown[]) => isOrganizationMember(...args),
	setLastActiveOrganization: (...args: unknown[]) =>
		setLastActiveOrganization(...args),
}));

beforeEach(() => {
	vi.clearAllMocks();
	setLastActiveOrganization.mockResolvedValue(undefined);
});

describe("persistActiveOrganizationChange()", () => {
	it("stores the org when a session update switches the active org", async () => {
		await persistActiveOrganizationChange(
			{ activeOrganizationId: "org-1" },
			"user-1",
		);
		expect(setLastActiveOrganization).toHaveBeenCalledWith("user-1", "org-1");
	});

	it("clears it when the user switches to the personal workspace", async () => {
		await persistActiveOrganizationChange(
			{ activeOrganizationId: null },
			"user-1",
		);
		expect(setLastActiveOrganization).toHaveBeenCalledWith("user-1", null);
	});

	it("ignores session updates that do not touch the active org", async () => {
		await persistActiveOrganizationChange(
			{ expiresAt: new Date(), updatedAt: new Date() },
			"user-1",
		);
		expect(setLastActiveOrganization).not.toHaveBeenCalled();
	});

	it("ignores updates without a known user", async () => {
		await persistActiveOrganizationChange(
			{ activeOrganizationId: "org-1" },
			undefined,
		);
		expect(setLastActiveOrganization).not.toHaveBeenCalled();
	});

	it("never throws when the write fails", async () => {
		setLastActiveOrganization.mockRejectedValueOnce(new Error("db down"));
		await expect(
			persistActiveOrganizationChange(
				{ activeOrganizationId: "org-1" },
				"user-1",
			),
		).resolves.toBeUndefined();
	});
});

describe("restoreActiveOrganization()", () => {
	it("restores the last active org on a new session", async () => {
		getUserById.mockResolvedValue({ lastActiveOrganizationId: "org-1" });
		isOrganizationMember.mockResolvedValue(true);

		await expect(restoreActiveOrganization({ userId: "user-1" })).resolves.toBe(
			"org-1",
		);
		expect(isOrganizationMember).toHaveBeenCalledWith("user-1", "org-1");
	});

	it("does not restore an org the user is no longer a member of", async () => {
		getUserById.mockResolvedValue({ lastActiveOrganizationId: "org-gone" });
		isOrganizationMember.mockResolvedValue(false);

		await expect(
			restoreActiveOrganization({ userId: "user-1" }),
		).resolves.toBeNull();
	});

	it("returns null when there is no last active org", async () => {
		getUserById.mockResolvedValue({ lastActiveOrganizationId: null });

		await expect(
			restoreActiveOrganization({ userId: "user-1" }),
		).resolves.toBeNull();
		expect(isOrganizationMember).not.toHaveBeenCalled();
	});

	it("keeps an active org the new session already carries", async () => {
		await expect(
			restoreActiveOrganization({
				userId: "user-1",
				activeOrganizationId: "org-2",
			}),
		).resolves.toBeNull();
		expect(getUserById).not.toHaveBeenCalled();
	});

	it("never breaks sign-in when the lookup fails", async () => {
		getUserById.mockRejectedValue(new Error("db down"));

		await expect(
			restoreActiveOrganization({ userId: "user-1" }),
		).resolves.toBeNull();
	});
});
