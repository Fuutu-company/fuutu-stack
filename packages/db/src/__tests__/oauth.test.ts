import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../prisma/client", () => ({
	db: {
		oauthClient: { findUnique: vi.fn(), deleteMany: vi.fn() },
		oauthConsent: {
			findUnique: vi.fn(),
			findMany: vi.fn(),
			deleteMany: vi.fn(),
		},
		oauthAccessToken: { deleteMany: vi.fn() },
		oauthRefreshToken: { deleteMany: vi.fn() },
		organization: { findMany: vi.fn() },
		$transaction: vi.fn(),
	},
}));

import { db } from "../../prisma/client";
import {
	deleteStaleUnownedOAuthClients,
	getOAuthClientSummary,
	getOAuthConsentOwner,
	isUnverifiedOAuthClient,
	listOAuthConnectedApps,
	revokeOAuthClientAccess,
	revokeOAuthTokensForUser,
} from "../../prisma/queries/oauth";

describe("oauth queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Batch transactions resolve to the per-operation results.
		vi.mocked(db.$transaction).mockImplementation((async (ops: unknown[]) =>
			Promise.all(ops)) as never);
	});

	describe("isUnverifiedOAuthClient", () => {
		it("is unverified without user, reference owner or skip-consent trust", () => {
			expect(
				isUnverifiedOAuthClient({
					userId: null,
					referenceId: null,
					skipConsent: null,
				}),
			).toBe(true);
		});

		it.each([
			[{ userId: "u1", referenceId: null, skipConsent: null }],
			[{ userId: null, referenceId: "org-1", skipConsent: false }],
			[{ userId: null, referenceId: null, skipConsent: true }],
		])("is verified for %o", (client) => {
			expect(isUnverifiedOAuthClient(client)).toBe(false);
		});
	});

	it("getOAuthClientSummary selects display + ownership fields only", async () => {
		vi.mocked(db.oauthClient.findUnique).mockResolvedValue(null);
		await getOAuthClientSummary("client-1");
		expect(db.oauthClient.findUnique).toHaveBeenCalledWith({
			where: { clientId: "client-1" },
			select: {
				clientId: true,
				name: true,
				uri: true,
				icon: true,
				userId: true,
				referenceId: true,
				skipConsent: true,
				disabled: true,
			},
		});
	});

	it("getOAuthConsentOwner looks up the consent's user and client", async () => {
		vi.mocked(db.oauthConsent.findUnique).mockResolvedValue(null);
		await getOAuthConsentOwner("consent-1");
		expect(db.oauthConsent.findUnique).toHaveBeenCalledWith({
			where: { id: "consent-1" },
			select: { userId: true, clientId: true },
		});
	});

	describe("listOAuthConnectedApps", () => {
		it("groups the user's consents per client with org names and merged scopes", async () => {
			vi.mocked(db.oauthConsent.findMany).mockResolvedValue([
				{
					clientId: "c1",
					scopes: ["openid", "profile"],
					referenceId: "org-1",
					createdAt: new Date("2026-11-01T00:00:00Z"),
					client: {
						name: "Claude",
						uri: null,
						icon: null,
						userId: null,
						referenceId: null,
						skipConsent: null,
					},
				},
				{
					clientId: "c1",
					scopes: ["openid", "offline_access"],
					referenceId: "org-2",
					createdAt: new Date("2026-11-05T00:00:00Z"),
					client: {
						name: "Claude",
						uri: null,
						icon: null,
						userId: null,
						referenceId: null,
						skipConsent: null,
					},
				},
				{
					clientId: "c2",
					scopes: ["openid"],
					referenceId: null,
					createdAt: new Date("2026-11-03T00:00:00Z"),
					client: {
						name: "Internal tool",
						uri: "https://tool.example.com",
						icon: null,
						userId: "owner-1",
						referenceId: null,
						skipConsent: null,
					},
				},
			] as never);
			vi.mocked(db.organization.findMany).mockResolvedValue([
				{ id: "org-1", name: "Acme" },
				{ id: "org-2", name: "Globex" },
			] as never);

			const apps = await listOAuthConnectedApps("user-1");

			expect(db.oauthConsent.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { userId: "user-1" } }),
			);
			expect(db.organization.findMany).toHaveBeenCalledWith({
				where: { id: { in: ["org-1", "org-2"] } },
				select: { id: true, name: true },
			});
			expect(apps).toEqual([
				{
					clientId: "c1",
					name: "Claude",
					uri: null,
					unverified: true,
					grantedAt: new Date("2026-11-01T00:00:00Z"),
					scopes: ["openid", "profile", "offline_access"],
					organizations: ["Acme", "Globex"],
				},
				{
					clientId: "c2",
					name: "Internal tool",
					uri: "https://tool.example.com",
					unverified: false,
					grantedAt: new Date("2026-11-03T00:00:00Z"),
					scopes: ["openid"],
					organizations: [],
				},
			]);
		});

		it("skips the organization lookup when no consent carries an org", async () => {
			vi.mocked(db.oauthConsent.findMany).mockResolvedValue([]);
			expect(await listOAuthConnectedApps("user-1")).toEqual([]);
			expect(db.organization.findMany).not.toHaveBeenCalled();
		});
	});

	it("revokeOAuthClientAccess deletes consents, refresh and access tokens of that user+client only", async () => {
		vi.mocked(db.oauthAccessToken.deleteMany).mockResolvedValue({
			count: 2,
		} as never);
		vi.mocked(db.oauthRefreshToken.deleteMany).mockResolvedValue({
			count: 1,
		} as never);
		vi.mocked(db.oauthConsent.deleteMany).mockResolvedValue({
			count: 1,
		} as never);

		const result = await revokeOAuthClientAccess("user-1", "client-1");

		const where = { userId: "user-1", clientId: "client-1" };
		expect(db.oauthAccessToken.deleteMany).toHaveBeenCalledWith({ where });
		expect(db.oauthRefreshToken.deleteMany).toHaveBeenCalledWith({ where });
		expect(db.oauthConsent.deleteMany).toHaveBeenCalledWith({ where });
		expect(db.$transaction).toHaveBeenCalledTimes(1);
		expect(result).toEqual({ accessTokens: 2, refreshTokens: 1, consents: 1 });
	});

	it("revokeOAuthTokensForUser deletes every refresh and access token of the user", async () => {
		vi.mocked(db.oauthAccessToken.deleteMany).mockResolvedValue({
			count: 3,
		} as never);
		vi.mocked(db.oauthRefreshToken.deleteMany).mockResolvedValue({
			count: 2,
		} as never);

		const result = await revokeOAuthTokensForUser("user-1");

		expect(db.oauthAccessToken.deleteMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
		});
		expect(db.oauthRefreshToken.deleteMany).toHaveBeenCalledWith({
			where: { userId: "user-1" },
		});
		expect(db.oauthConsent.deleteMany).not.toHaveBeenCalled();
		expect(result).toEqual({ accessTokens: 3, refreshTokens: 2 });
	});

	it("revokeOAuthTokensForUser narrows to one client when given", async () => {
		vi.mocked(db.oauthAccessToken.deleteMany).mockResolvedValue({
			count: 0,
		} as never);
		vi.mocked(db.oauthRefreshToken.deleteMany).mockResolvedValue({
			count: 1,
		} as never);

		await revokeOAuthTokensForUser("user-1", "client-1");

		const where = { userId: "user-1", clientId: "client-1" };
		expect(db.oauthAccessToken.deleteMany).toHaveBeenCalledWith({ where });
		expect(db.oauthRefreshToken.deleteMany).toHaveBeenCalledWith({ where });
	});

	it("deleteStaleUnownedOAuthClients only targets unused owner-less clients created before the cutoff", async () => {
		vi.mocked(db.oauthClient.deleteMany).mockResolvedValue({
			count: 4,
		} as never);
		const cutoff = new Date("2026-11-05T00:00:00Z");

		expect(await deleteStaleUnownedOAuthClients(cutoff)).toEqual({ count: 4 });
		expect(db.oauthClient.deleteMany).toHaveBeenCalledWith({
			where: {
				userId: null,
				referenceId: null,
				OR: [{ skipConsent: null }, { skipConsent: false }],
				createdAt: { lt: cutoff },
				consents: { none: {} },
				refreshTokens: { none: {} },
				accessTokens: { none: {} },
			},
		});
	});
});
