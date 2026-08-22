import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { apiKeysRouter } from "../modules/api-keys/router";

vi.mock("@fuutu/db", () => ({
	createApiKey: vi.fn(),
	listApiKeys: vi.fn(),
	listOrgApiKeys: vi.fn(),
	countApiKeys: vi.fn(),
	countOrgApiKeys: vi.fn(),
	revokeApiKey: vi.fn(),
	deleteApiKey: vi.fn(),
	getApiKey: vi.fn(),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

const {
	createApiKey,
	listApiKeys,
	listOrgApiKeys,
	countApiKeys,
	countOrgApiKeys,
	revokeApiKey,
	deleteApiKey,
	getApiKey,
} = await import("@fuutu/db");
const { auth } = await import("@fuutu/auth");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [
		{ userId: "user-1", role: "owner", id: "member-1" },
		{ userId: "user-2", role: "member", id: "member-2" },
	],
	invitations: [],
};

const KEY_ID = "00000000-0000-4000-8000-000000000001";
const KEY_ID_404 = "00000000-0000-4000-8000-000000000404";

describe("apiKeys.create", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("creates an API key and returns the plaintext key once", async () => {
		vi.mocked(createApiKey).mockResolvedValue({
			id: KEY_ID,
			key: "futu_sk_abc123",
			prefix: "futu_sk_abc...",
		});

		const result = await call(
			apiKeysRouter.create,
			{ name: "My Key" },
			{ context: authenticatedContext },
		);

		expect(createApiKey).toHaveBeenCalledWith("user-1", "My Key", null, null);
		expect(result).toEqual({
			id: KEY_ID,
			key: "futu_sk_abc123",
			prefix: "futu_sk_abc...",
		});
	});

	it("passes organizationId and expiresAt when provided", async () => {
		vi.mocked(createApiKey).mockResolvedValue({
			id: "00000000-0000-4000-8000-000000000002",
			key: "futu_sk_xyz",
			prefix: "futu_sk_xyz...",
		});

		const expiry = new Date("2025-12-31");
		await call(
			apiKeysRouter.create,
			{ name: "Org Key", organizationId: "org-1", expiresAt: expiry },
			{ context: authenticatedContext },
		);

		expect(createApiKey).toHaveBeenCalledWith(
			"user-1",
			"Org Key",
			"org-1",
			expiry,
		);
	});

	it("allows org-level key creation by a member (member has full CRUD on api-keys)", async () => {
		const memberContext = makeSession<Context>(
			makeUser({ id: "user-2", role: "user" }),
		);

		const result = await call(
			apiKeysRouter.create,
			{ name: "Org Key by Member", organizationId: "org-1" },
			{ context: memberContext },
		);
		expect(result).toBeDefined();
		expect(result.key).toBeDefined();
	});

	it("rejects empty name", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects name exceeding 100 characters", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "x".repeat(101) },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Key" },
				{
					context: unauthenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("apiKeys.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("lists keys for the current user", async () => {
		vi.mocked(listApiKeys).mockResolvedValue([
			{ id: KEY_ID, name: "My Key", prefix: "futu_sk_abc..." },
		] as never);
		vi.mocked(countApiKeys).mockResolvedValue(1);

		const result = await call(
			apiKeysRouter.list,
			{},
			{ context: authenticatedContext },
		);

		expect(listApiKeys).toHaveBeenCalledWith("user-1", {
			take: 50,
			skip: 0,
		});
		expect(result).toEqual({
			items: [{ id: KEY_ID, name: "My Key", prefix: "futu_sk_abc..." }],
			page: 1,
			limit: 50,
			total: 1,
			totalPages: 1,
		});
	});

	it("lists org keys when organizationId is provided", async () => {
		vi.mocked(listOrgApiKeys).mockResolvedValue([
			{
				id: "00000000-0000-4000-8000-000000000002",
				name: "Org Key",
				prefix: "futu_sk_xyz...",
			},
		] as never);
		vi.mocked(countOrgApiKeys).mockResolvedValue(1);

		const result = await call(
			apiKeysRouter.list,
			{ organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(listOrgApiKeys).toHaveBeenCalledWith("org-1", {
			take: 50,
			skip: 0,
		});
		expect(result.items).toHaveLength(1);
		expect(result.total).toBe(1);
	});

	it("returns empty items when no keys exist", async () => {
		vi.mocked(listApiKeys).mockResolvedValue([] as never);
		vi.mocked(countApiKeys).mockResolvedValue(0);

		const result = await call(
			apiKeysRouter.list,
			{},
			{ context: authenticatedContext },
		);

		expect(result).toEqual({
			items: [],
			page: 1,
			limit: 50,
			total: 0,
			totalPages: 1,
		});
	});
});

describe("apiKeys.revoke", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("revokes a personal API key owned by the user", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-1",
			organizationId: null,
		} as never);
		vi.mocked(revokeApiKey).mockResolvedValue({
			id: KEY_ID,
			revokedAt: new Date(),
		} as never);

		const result = await call(
			apiKeysRouter.revoke,
			{ id: KEY_ID },
			{ context: authenticatedContext },
		);

		expect(revokeApiKey).toHaveBeenCalledWith(KEY_ID, { userId: "user-1" });
		expect(result).toEqual({ success: true });
	});

	it("revokes an org-level API key when user is org admin", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-2",
			organizationId: "org-1",
		} as never);
		vi.mocked(revokeApiKey).mockResolvedValue({
			id: KEY_ID,
			revokedAt: new Date(),
		} as never);

		const result = await call(
			apiKeysRouter.revoke,
			{ id: KEY_ID },
			{ context: authenticatedContext },
		);

		expect(revokeApiKey).toHaveBeenCalledWith(KEY_ID, {
			organizationId: "org-1",
		});
		expect(result).toEqual({ success: true });
	});

	it("throws FORBIDDEN when revoking another user's personal key", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-2",
			organizationId: null,
		} as never);

		await expect(
			call(
				apiKeysRouter.revoke,
				{ id: KEY_ID },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws NOT_FOUND when key does not exist", async () => {
		vi.mocked(getApiKey).mockResolvedValue(null as never);

		await expect(
			call(
				apiKeysRouter.revoke,
				{ id: KEY_ID_404 },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});

	it("rejects invalid id format", async () => {
		await expect(
			call(
				apiKeysRouter.revoke,
				{ id: "not-a-uuid" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});
});

describe("apiKeys.delete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
	});

	it("deletes a personal API key owned by the user", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-1",
			organizationId: null,
		} as never);
		vi.mocked(deleteApiKey).mockResolvedValue({
			id: KEY_ID,
		} as never);

		const result = await call(
			apiKeysRouter.delete,
			{ id: KEY_ID },
			{ context: authenticatedContext },
		);

		expect(deleteApiKey).toHaveBeenCalledWith(KEY_ID, { userId: "user-1" });
		expect(result).toEqual({ success: true });
	});

	it("deletes an org-level API key when user is org admin", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-2",
			organizationId: "org-1",
		} as never);
		vi.mocked(deleteApiKey).mockResolvedValue({
			id: KEY_ID,
		} as never);

		const result = await call(
			apiKeysRouter.delete,
			{ id: KEY_ID },
			{ context: authenticatedContext },
		);

		expect(deleteApiKey).toHaveBeenCalledWith(KEY_ID, {
			organizationId: "org-1",
		});
		expect(result).toEqual({ success: true });
	});

	it("throws FORBIDDEN when deleting another user's personal key", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-2",
			organizationId: null,
		} as never);

		await expect(
			call(
				apiKeysRouter.delete,
				{ id: KEY_ID },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
	});

	it("throws NOT_FOUND when key does not exist", async () => {
		vi.mocked(getApiKey).mockResolvedValue(null as never);

		await expect(
			call(
				apiKeysRouter.delete,
				{ id: KEY_ID_404 },
				{
					context: authenticatedContext,
				},
			),
		).rejects.toMatchObject({ code: "NOT_FOUND" });
	});
});
