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
	db: {
		user: {
			update: vi.fn(),
		},
	},
}));

const { db } = await import("@fuutu/db");

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
		vi.mocked(db.user.update).mockResolvedValue({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Updated Name",
			image: "https://example.com/avatar.png",
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		} as never);

		const result = await call(
			updateUserProfile,
			{ name: "Updated Name", image: "https://example.com/avatar.png" },
			{ context: authenticatedContext },
		);

		expect(db.user.update).toHaveBeenCalledWith({
			where: { id: "user-1" },
			data: { name: "Updated Name", image: "https://example.com/avatar.png" },
		});
		expect(result).toEqual({
			id: "user-1",
			email: "test@fuutu.local",
			name: "Updated Name",
			image: "https://example.com/avatar.png",
			emailVerified: true,
			createdAt: new Date("2024-01-01"),
		});
	});

	it("rejects empty name", async () => {
		await expect(
			call(updateUserProfile, { name: "" }, { context: authenticatedContext }),
		).rejects.toBeDefined();
	});

	it("rejects invalid image URL", async () => {
		await expect(
			call(
				updateUserProfile,
				{ image: "not-a-url" },
				{ context: authenticatedContext },
			),
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
