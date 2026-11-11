import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMcpPrincipal } from "../mcp/principal";

vi.mock("@fuutu/db", () => ({
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationWithMembers: vi.fn(),
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

const { verifyApiKeyWithOwner, getOrganizationWithMembers } = await import(
	"@fuutu/db"
);
const { apiConfig } = await import("../config");

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
		vi.mocked(getOrganizationWithMembers).mockResolvedValue({
			members: [{ userId: "user-1", role: "admin" }],
		} as never);
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
});
