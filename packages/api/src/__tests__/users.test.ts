import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { getCurrentUser } from "../modules/users/procedures/get-current-user";
import { updateUserProfile } from "../modules/users/procedures/update-user-profile";

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/db", () => ({
	updateUserProfile: vi.fn(),
}));

const { updateUserProfile: updateUserProfileDb } = await import("@fuutu/db");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

describe("users.getCurrentUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the current user when authenticated", async () => {
		const result = await call(getCurrentUser, undefined, {
			context: authenticatedContext,
		});

		expect(result).toEqual({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Test User",
			image: null,
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		});
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(getCurrentUser, undefined, { context: unauthenticatedContext }),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("users.updateProfile", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("updates the user profile with valid input", async () => {
		vi.mocked(updateUserProfileDb).mockResolvedValue({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Updated Name",
			image: "/image-proxy/avatars/user-1/me.png",
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		} as never);

		const result = await call(
			updateUserProfile,
			{ name: "Updated Name", image: "/image-proxy/avatars/user-1/me.png" },
			{ context: authenticatedContext },
		);

		expect(updateUserProfileDb).toHaveBeenCalledWith("user-1", {
			name: "Updated Name",
			image: "/image-proxy/avatars/user-1/me.png",
		});
		expect(result).toEqual({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Updated Name",
			image: "/image-proxy/avatars/user-1/me.png",
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		});
	});

	it.each([
		["an external URL", "https://evil.example/pixel.png"],
		["another user's upload", "/image-proxy/avatars/user-2/me.png"],
		["a path traversal key", "/image-proxy/avatars/user-1/../user-2/me.png"],
		[
			"the organization-logos alias",
			"/image-proxy/organization-logos/user-1/a.png",
		],
	])("rejects %s as image with BAD_REQUEST", async (_label, image) => {
		await expect(
			call(updateUserProfile, { image }, { context: authenticatedContext }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		expect(updateUserProfileDb).not.toHaveBeenCalled();
	});

	it("accepts a null image to remove the avatar", async () => {
		vi.mocked(updateUserProfileDb).mockResolvedValue({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Test User",
			image: null,
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		} as never);

		await call(
			updateUserProfile,
			{ image: null },
			{ context: authenticatedContext },
		);

		expect(updateUserProfileDb).toHaveBeenCalledWith("user-1", {
			image: null,
		});
	});

	it("rejects empty name", async () => {
		await expect(
			call(updateUserProfile, { name: "" }, { context: authenticatedContext }),
		).rejects.toBeDefined();
	});

	it("rejects name exceeding 100 characters", async () => {
		await expect(
			call(
				updateUserProfile,
				{ name: "x".repeat(101) },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				updateUserProfile,
				{ name: "Updated Name" },
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});
