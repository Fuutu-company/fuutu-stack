import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMcpPrincipal } from "../mcp/principal";

vi.mock("@fuutu/db", () => ({
	API_KEY_PREFIX: "futu_sk_",
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
	getUserById: vi.fn(),
}));

const { CHALLENGE } = vi.hoisted(() => ({
	CHALLENGE:
		'Bearer resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/api/mcp"',
}));

vi.mock("@fuutu/auth/mcp-oauth", () => ({
	MCP_ORG_CLAIM: "org_id",
	mcpOAuth: { challenge: CHALLENGE, active: true },
	verifyMcpAccessToken: vi.fn(),
}));

vi.mock("@fuutu/payments", () => ({
	getOrgEntitlement: vi.fn(),
}));

vi.mock("../config", () => ({
	apiConfig: {
		apiKeyScopes: ["mcp", "versioning"],
		apiKeyScopeFeatures: {},
		rateLimit: { enabled: false },
	},
}));

const {
	verifyApiKeyWithOwner,
	getOrganizationMemberRole,
	getOrganizationWithMembers,
	getUserById,
} = await import("@fuutu/db");
const { apiConfig } = await import("../config");
const { mcpOAuth, verifyMcpAccessToken } = await import(
	"@fuutu/auth/mcp-oauth"
);

const ORG_KEY = {
	apiKey: { id: "key-1", organizationId: "org-1", scopes: ["mcp"] },
	user: { id: "user-1", banned: false, role: "user" },
};

const request = (key?: string) =>
	new Request("http://localhost/api/mcp", {
		method: "POST",
		headers: key ? { authorization: `Bearer ${key}` } : {},
	});

describe("resolveMcpPrincipal", () => {
	beforeEach(() => {
		vi.mocked(verifyApiKeyWithOwner).mockReset();
		vi.mocked(verifyMcpAccessToken).mockReset();
		vi.mocked(getUserById).mockReset();
		(mcpOAuth as { active: boolean }).active = true;
		vi.mocked(getOrganizationMemberRole).mockResolvedValue("admin");
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {};
	});

	it("is anonymous without a credential", async () => {
		expect(await resolveMcpPrincipal(request())).toEqual({
			kind: "anonymous",
		});
		expect(verifyApiKeyWithOwner).not.toHaveBeenCalled();
	});

	it("rejects an unknown key with 401 (no silent downgrade)", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null);
		const res = await resolveMcpPrincipal(request("futu_sk_bad"));
		expect(res).toBeInstanceOf(Response);
		expect((res as Response).status).toBe(401);
	});

	it("rejects a key without the mcp scope", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...ORG_KEY,
			apiKey: { ...ORG_KEY.apiKey, scopes: ["versioning"] },
		} as never);
		expect(
			((await resolveMcpPrincipal(request("futu_sk_x"))) as Response).status,
		).toBe(401);
	});

	it("rejects keys of banned users", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...ORG_KEY,
			user: { ...ORG_KEY.user, banned: true },
		} as never);
		expect(
			((await resolveMcpPrincipal(request("futu_sk_x"))) as Response).status,
		).toBe(401);
	});

	it("rejects keys whose owner is no longer a member of the key's org", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(ORG_KEY as never);
		vi.mocked(getOrganizationMemberRole).mockResolvedValue(null);
		expect(
			((await resolveMcpPrincipal(request("futu_sk_x"))) as Response).status,
		).toBe(401);
		expect(getOrganizationMemberRole).toHaveBeenCalledWith("org-1", "user-1");
	});

	it("resolves user, org, org role and scopes for a valid key", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(ORG_KEY as never);
		expect(await resolveMcpPrincipal(request("futu_sk_ok"))).toEqual({
			kind: "user",
			via: "api-key",
			credentialId: "key-1",
			userId: "user-1",
			organizationId: "org-1",
			orgRole: "admin",
			systemRole: "user",
			scopes: ["mcp"],
		});
	});

	it("returns 402 when the scope is feature-gated and the org lacks it", async () => {
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {
			mcp: "mcpAccess",
		};
		const { getOrgEntitlement } = await import("@fuutu/payments");
		vi.mocked(getOrgEntitlement).mockResolvedValue({ features: [] } as never);
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(ORG_KEY as never);
		const res = (await resolveMcpPrincipal(request("futu_sk_ok"))) as Response;
		expect(res.status).toBe(402);
	});

	it("sends the OAuth challenge on 401 so clients can start the flow", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null);
		const res = (await resolveMcpPrincipal(request("futu_sk_bad"))) as Response;
		expect(res.headers.get("www-authenticate")).toBe(CHALLENGE);
	});
});

describe("resolveMcpPrincipal — OAuth access tokens", () => {
	const CLAIMS = {
		sub: "user-1",
		azp: "client-1",
		jti: "jti-1",
		scope: "openid profile offline_access",
		org_id: "org-1",
	};

	beforeEach(() => {
		vi.mocked(verifyApiKeyWithOwner).mockReset();
		vi.mocked(verifyMcpAccessToken).mockReset();
		vi.mocked(getUserById).mockReset();
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			banned: false,
			role: "user",
		} as never);
		vi.mocked(getOrganizationWithMembers).mockReset();
		vi.mocked(getOrganizationWithMembers).mockResolvedValue({
			members: [{ userId: "user-1", role: "owner" }],
		} as never);
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {};
		(mcpOAuth as { active: boolean }).active = true;
	});

	it("resolves user, org, member role and token scopes for a valid token", async () => {
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		expect(await resolveMcpPrincipal(request("eyJ.valid.jwt"))).toEqual({
			kind: "user",
			via: "oauth",
			credentialId: "jti-1",
			userId: "user-1",
			organizationId: "org-1",
			orgRole: "owner",
			systemRole: "user",
			scopes: ["openid", "profile", "offline_access"],
		});
		expect(verifyMcpAccessToken).toHaveBeenCalledWith("eyJ.valid.jwt");
		expect(verifyApiKeyWithOwner).not.toHaveBeenCalled();
		expect(getOrganizationWithMembers).toHaveBeenCalledWith("org-1");
	});

	it("rejects an expired or invalid token with 401 and the challenge", async () => {
		vi.mocked(verifyMcpAccessToken).mockRejectedValue(new Error("exp"));
		const res = (await resolveMcpPrincipal(
			request("eyJ.expired.jwt"),
		)) as Response;
		expect(res.status).toBe(401);
		expect(res.headers.get("www-authenticate")).toBe(CHALLENGE);
		expect(getUserById).not.toHaveBeenCalled();
	});

	it("rejects a token without a subject", async () => {
		vi.mocked(verifyMcpAccessToken).mockResolvedValue({ azp: "client-1" });
		const res = (await resolveMcpPrincipal(request("eyJ.m2m.jwt"))) as Response;
		expect(res.status).toBe(401);
	});

	it("rejects tokens of banned users", async () => {
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		vi.mocked(getUserById).mockResolvedValue({
			id: "user-1",
			banned: true,
			role: "user",
		} as never);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res.status).toBe(401);
	});

	it("rejects tokens of deleted users", async () => {
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		vi.mocked(getUserById).mockResolvedValue(null);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res.status).toBe(401);
	});

	it("drops the organization when the user is no longer a member", async () => {
		vi.mocked(verifyMcpAccessToken).mockResolvedValue({
			...CLAIMS,
			org_id: "org-other",
		});
		vi.mocked(getOrganizationWithMembers).mockResolvedValue({
			members: [{ userId: "someone-else", role: "owner" }],
		} as never);
		expect(await resolveMcpPrincipal(request("eyJ.valid.jwt"))).toMatchObject({
			kind: "user",
			via: "oauth",
			userId: "user-1",
			organizationId: null,
			orgRole: null,
		});
	});

	it("has no organization when the token carries no org claim", async () => {
		const { org_id: _omit, ...withoutOrg } = CLAIMS;
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(withoutOrg);
		expect(await resolveMcpPrincipal(request("eyJ.valid.jwt"))).toMatchObject({
			organizationId: null,
			orgRole: null,
		});
		expect(getOrganizationWithMembers).not.toHaveBeenCalled();
	});

	it("falls back to the client id as credential id without a jti", async () => {
		const { jti: _omit, ...withoutJti } = CLAIMS;
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(withoutJti);
		expect(await resolveMcpPrincipal(request("eyJ.valid.jwt"))).toMatchObject({
			credentialId: "client-1",
		});
	});

	it("returns 402 when MCP is feature-gated and the token's org lacks it", async () => {
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {
			mcp: "mcpAccess",
		};
		const { getOrgEntitlement } = await import("@fuutu/payments");
		vi.mocked(getOrgEntitlement).mockResolvedValue({ features: [] } as never);
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res.status).toBe(402);
	});

	it("returns 402 when MCP is feature-gated and the token carries no org", async () => {
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {
			mcp: "mcpAccess",
		};
		const { org_id: _omit, ...withoutOrg } = CLAIMS;
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(withoutOrg);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res).toBeInstanceOf(Response);
		expect(res.status).toBe(402);
		expect(await res.json()).toMatchObject({
			error: "upgrade_required",
			feature: "mcpAccess",
			upgradeUrl: expect.stringMatching(/\/pricing$/),
		});
	});

	it("returns 402 when MCP is feature-gated and the org membership was dropped", async () => {
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {
			mcp: "mcpAccess",
		};
		const { getOrgEntitlement } = await import("@fuutu/payments");
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			features: ["mcpAccess"],
		} as never);
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		vi.mocked(getOrganizationWithMembers).mockResolvedValue({
			members: [{ userId: "someone-else", role: "owner" }],
		} as never);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res).toBeInstanceOf(Response);
		expect(res.status).toBe(402);
	});

	it("admits an org token when MCP is feature-gated and the org has the feature", async () => {
		(apiConfig.apiKeyScopeFeatures as Record<string, string>) = {
			mcp: "mcpAccess",
		};
		const { getOrgEntitlement } = await import("@fuutu/payments");
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			features: ["mcpAccess"],
		} as never);
		vi.mocked(verifyMcpAccessToken).mockResolvedValue(CLAIMS);
		expect(await resolveMcpPrincipal(request("eyJ.valid.jwt"))).toMatchObject({
			kind: "user",
			organizationId: "org-1",
		});
	});

	it("keeps the API-key path for the x-api-key header", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(ORG_KEY as never);
		const res = await resolveMcpPrincipal(
			new Request("http://localhost/api/mcp", {
				method: "POST",
				headers: { "x-api-key": "not-prefixed" },
			}),
		);
		expect(verifyMcpAccessToken).not.toHaveBeenCalled();
		expect(res).toMatchObject({ via: "api-key" });
	});

	it("treats every bearer as an API key when OAuth is disabled", async () => {
		(mcpOAuth as { active: boolean }).active = false;
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null);
		const res = (await resolveMcpPrincipal(
			request("eyJ.valid.jwt"),
		)) as Response;
		expect(res.status).toBe(401);
		expect(verifyMcpAccessToken).not.toHaveBeenCalled();
		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("eyJ.valid.jwt");
	});
});
