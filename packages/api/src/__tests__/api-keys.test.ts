import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { apiKeysRouter } from "../modules/api-keys/router";

// Kit tests run on a fixed plan catalog (@fuutu/test-utils), not the
// app's PLANS — an app that replaces its catalog keeps them meaningful.
vi.mock("@fuutu/payments/config", async (importOriginal) => ({
	...(await importOriginal<typeof import("@fuutu/payments/config")>()),
	...(await import("@fuutu/test-utils")).planCatalogFixture,
}));

vi.mock("@fuutu/db", () => ({
	createApiKeyWithinLimit: vi.fn(),
	listApiKeys: vi.fn(),
	listOrgApiKeys: vi.fn(),
	countApiKeys: vi.fn(),
	countOrgApiKeys: vi.fn(),
	revokeApiKey: vi.fn(),
	deleteApiKey: vi.fn(),
	getApiKey: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
	getActiveSubscriptionForUser: vi.fn().mockResolvedValue(null),
	getActiveSubscriptionForOrganization: vi.fn().mockResolvedValue(null),
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
	createApiKeyWithinLimit,
	listApiKeys,
	listOrgApiKeys,
	countApiKeys,
	countOrgApiKeys,
	revokeApiKey,
	deleteApiKey,
	getApiKey,
	getOrganizationWithMembers,
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
		vi.mocked(createApiKeyWithinLimit).mockResolvedValue({
			id: KEY_ID,
			key: "futu_sk_abc123",
			prefix: "futu_sk_abc...",
		});
		vi.mocked(countApiKeys).mockResolvedValue(0);
		vi.mocked(countOrgApiKeys).mockResolvedValue(0);
	});

	it("creates an API key and returns the plaintext key once", async () => {
		const result = await call(
			apiKeysRouter.create,
			{ name: "My Key" },
			{ context: authenticatedContext },
		);

		expect(createApiKeyWithinLimit).toHaveBeenCalledWith({
			userId: "user-1",
			name: "My Key",
			organizationId: null,
			expiresAt: null,
			max: 2, // free plan apiKeys limit
		});
		expect(result).toEqual({
			id: KEY_ID,
			key: "futu_sk_abc123",
			prefix: "futu_sk_abc...",
		});
	});

	it("passes organizationId and expiresAt when provided", async () => {
		const expiry = new Date("2025-12-31");
		await call(
			apiKeysRouter.create,
			{ name: "Org Key", organizationId: "org-1", expiresAt: expiry },
			{ context: authenticatedContext },
		);

		expect(createApiKeyWithinLimit).toHaveBeenCalledWith({
			userId: "user-1",
			name: "Org Key",
			organizationId: "org-1",
			expiresAt: expiry,
			max: 2,
		});
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

	it("passes scopes through for an org key", async () => {
		await call(
			apiKeysRouter.create,
			{ name: "Scoped Key", organizationId: "org-1", scopes: ["mcp"] },
			{ context: authenticatedContext },
		);

		expect(createApiKeyWithinLimit).toHaveBeenCalledWith({
			userId: "user-1",
			name: "Scoped Key",
			organizationId: "org-1",
			expiresAt: null,
			max: 2,
			scopes: ["mcp"],
		});
	});

	it("accepts the api scope on an org key", async () => {
		await call(
			apiKeysRouter.create,
			{ name: "API Key", organizationId: "org-1", scopes: ["api"] },
			{ context: authenticatedContext },
		);

		expect(createApiKeyWithinLimit).toHaveBeenCalledWith(
			expect.objectContaining({ scopes: ["api"] }),
		);
	});

	it("rejects scopes on a personal key (scopes are an org-key concept)", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Scoped Key", scopes: ["mcp"] },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects an unknown scope", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{
					name: "Scoped Key",
					organizationId: "org-1",
					// Not in the vocabulary — the input type rejects it too.
					scopes: ["bogus-scope"] as never,
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
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

describe("api key ids", () => {
	beforeEach(() => vi.clearAllMocks());

	// ApiKey.id is @default(cuid()) — revoke/delete must accept it.
	const CUID = "cmwcs8x2k0001qz8h4f3a9b7d";

	it.each([
		["revoke", "revokeApiKey"],
		["delete", "deleteApiKey"],
	] as const)("%s accepts a cuid key id", async (route, query) => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: CUID,
			userId: "user-1",
			organizationId: null,
		} as never);
		const mocks = { revokeApiKey, deleteApiKey };
		vi.mocked(mocks[query]).mockResolvedValue({ id: CUID } as never);
		await call(
			apiKeysRouter[route],
			{ id: CUID },
			{ context: authenticatedContext },
		);
		expect(mocks[query]).toHaveBeenCalledWith(CUID, { userId: "user-1" });
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

// A key that reached oRPC (scope `api` or unscoped) authenticates as its
// owner — it must not be able to mint, revoke or delete keys, or a leaked
// key could escalate (wider scopes) or entrench itself.
describe("API-key-authenticated callers cannot manage API keys", () => {
	const orgKeyContext: Context = {
		...authenticatedContext,
		apiKey: { id: "key-caller", organizationId: "org-1" },
	};
	const personalKeyContext: Context = {
		...authenticatedContext,
		apiKey: { id: "key-caller", organizationId: null },
	};

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getOrganizationWithMembers).mockResolvedValue({
			id: "org-1",
			name: "Acme",
			slug: "acme",
			members: [
				{
					id: "member-1",
					userId: "user-1",
					role: "owner",
					user: { email: "test@fuutu.local" },
				},
			],
		} as never);
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
			orgFixture as never,
		);
		vi.mocked(createApiKeyWithinLimit).mockResolvedValue({
			id: KEY_ID,
			key: "futu_sk_abc123",
			prefix: "futu_sk_abc...",
		});
		vi.mocked(countApiKeys).mockResolvedValue(0);
		vi.mocked(countOrgApiKeys).mockResolvedValue(0);
		vi.mocked(listApiKeys).mockResolvedValue([] as never);
		vi.mocked(listOrgApiKeys).mockResolvedValue([] as never);
		vi.mocked(revokeApiKey).mockResolvedValue({ id: KEY_ID } as never);
		vi.mocked(deleteApiKey).mockResolvedValue({ id: KEY_ID } as never);
	});

	it("org key cannot create an org key for its own org", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Minted", organizationId: "org-1", scopes: ["mcp"] },
				{ context: orgKeyContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});

	it("personal key cannot create a personal key", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Minted" },
				{ context: personalKeyContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});

	it("personal key cannot create an org key", async () => {
		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Minted", organizationId: "org-1" },
				{ context: personalKeyContext },
			),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(createApiKeyWithinLimit).not.toHaveBeenCalled();
	});

	it.each([
		["revoke", "revokeApiKey"],
		["delete", "deleteApiKey"],
	] as const)(
		"personal key cannot %s the owner's other keys",
		async (route, query) => {
			vi.mocked(getApiKey).mockResolvedValue({
				id: KEY_ID,
				userId: "user-1",
				organizationId: null,
			} as never);
			const mocks = { revokeApiKey, deleteApiKey };

			await expect(
				call(
					apiKeysRouter[route],
					{ id: KEY_ID },
					{ context: personalKeyContext },
				),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
			expect(mocks[query]).not.toHaveBeenCalled();
		},
	);

	it.each([
		["revoke", "revokeApiKey"],
		["delete", "deleteApiKey"],
	] as const)("org key cannot %s an org key", async (route, query) => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-1",
			organizationId: "org-1",
		} as never);
		const mocks = { revokeApiKey, deleteApiKey };

		await expect(
			call(apiKeysRouter[route], { id: KEY_ID }, { context: orgKeyContext }),
		).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mocks[query]).not.toHaveBeenCalled();
	});

	it("org key may still list its org's keys", async () => {
		await expect(
			call(
				apiKeysRouter.list,
				{ organizationId: "org-1" },
				{ context: orgKeyContext },
			),
		).resolves.toMatchObject({ items: [], total: 0 });
	});

	it("session caller is unaffected", async () => {
		vi.mocked(getApiKey).mockResolvedValue({
			id: KEY_ID,
			userId: "user-1",
			organizationId: null,
		} as never);

		await expect(
			call(
				apiKeysRouter.create,
				{ name: "Session Key" },
				{ context: authenticatedContext },
			),
		).resolves.toMatchObject({ id: KEY_ID });
		await expect(
			call(
				apiKeysRouter.revoke,
				{ id: KEY_ID },
				{ context: authenticatedContext },
			),
		).resolves.toEqual({ success: true });
		await expect(
			call(
				apiKeysRouter.delete,
				{ id: KEY_ID },
				{ context: authenticatedContext },
			),
		).resolves.toEqual({ success: true });
	});
});
