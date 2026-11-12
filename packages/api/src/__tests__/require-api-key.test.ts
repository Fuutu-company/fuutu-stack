import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireApiKey } from "../modules/api-keys/require-api-key";

vi.mock("@fuutu/db", () => ({
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
}));

vi.mock("@fuutu/payments", () => ({
	getOrgEntitlement: vi.fn(),
}));

vi.mock("@fuutu/env/saas", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/env/saas")>();
	return {
		...actual,
		env: new Proxy(actual.env, {
			get(target, prop, receiver) {
				if (prop === "NEXT_PUBLIC_MARKETING_URL") {
					return "https://marketing.test";
				}
				return Reflect.get(target, prop, receiver);
			},
		}),
	};
});

// Mock the config with an active feature gate so both branches of the
// apiKeyScopeFeatures lookup are exercised ("versioning" → feature gate).
vi.mock("../config", () => ({
	apiConfig: {
		apiKeyScopes: ["mcp", "versioning"],
		apiKeyScopeFeatures: { versioning: "api_versioning" },
	},
}));

const { verifyApiKeyWithOwner, getOrganizationMemberRole } = await import(
	"@fuutu/db"
);
const { getOrgEntitlement } = await import("@fuutu/payments");

const ORG_KEY = {
	apiKey: {
		id: "key-1",
		organizationId: "org-1",
		scopes: ["mcp", "versioning"],
	},
	user: { id: "user-1", banned: false },
};

const bearerHeaders = (key?: string) =>
	new Headers(key ? { authorization: `Bearer ${key}` } : {});

async function expectHttpError(
	promise: Promise<unknown>,
	status: number,
	body: Record<string, unknown>,
) {
	try {
		await promise;
		expect.unreachable("expected requireApiKey to throw");
	} catch (e) {
		expect(e).toBeInstanceOf(HTTPException);
		const err = e as HTTPException;
		expect(err.status).toBe(status);
		expect(await err.getResponse().json()).toEqual(body);
	}
}

describe("requireApiKey", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(ORG_KEY as never);
		vi.mocked(getOrganizationMemberRole).mockResolvedValue("member");
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			features: ["api_versioning"],
		} as never);
	});

	it("throws 401 missing_api_key when no credential header is present", async () => {
		await expectHttpError(requireApiKey(new Headers(), "mcp"), 401, {
			error: "missing_api_key",
		});
	});

	it("throws 401 missing_api_key when authorization is not a Bearer scheme", async () => {
		await expectHttpError(
			requireApiKey(new Headers({ authorization: "Basic abc" }), "mcp"),
			401,
			{ error: "missing_api_key" },
		);
	});

	it("throws 401 invalid_api_key for an unknown key", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null as never);
		await expectHttpError(requireApiKey(bearerHeaders("bad"), "mcp"), 401, {
			error: "invalid_api_key",
		});
	});

	it("throws 401 invalid_api_key for a user-scoped key (no organizationId)", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-2", organizationId: null, scopes: ["mcp"] },
			user: { id: "user-2", banned: false },
		} as never);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "mcp"),
			401,
			{ error: "invalid_api_key" },
		);
	});

	it("throws 401 invalid_api_key when the key lacks the requested scope", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-3", organizationId: "org-1", scopes: ["mcp"] },
			user: { id: "user-1", banned: false },
		} as never);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "versioning"),
			401,
			{ error: "invalid_api_key" },
		);
	});

	it("throws 401 invalid_api_key for an unrestricted full credential (empty scopes)", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-4", organizationId: "org-1", scopes: [] },
			user: { id: "user-1", banned: false },
		} as never);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "mcp"),
			401,
			{
				error: "invalid_api_key",
			},
		);
	});

	it("throws 401 invalid_api_key when the key owner is banned", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...ORG_KEY,
			user: { id: "user-1", banned: true },
		} as never);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "mcp"),
			401,
			{
				error: "invalid_api_key",
			},
		);
	});

	it("throws 401 invalid_api_key when the key owner left the org", async () => {
		vi.mocked(getOrganizationMemberRole).mockResolvedValue(null);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "mcp"),
			401,
			{ error: "invalid_api_key" },
		);
		expect(getOrganizationMemberRole).toHaveBeenCalledWith("org-1", "user-1");
	});

	it("throws 402 upgrade_required when the org lacks the gated feature", async () => {
		vi.mocked(getOrgEntitlement).mockResolvedValue({
			features: [],
		} as never);
		await expectHttpError(
			requireApiKey(bearerHeaders("futu_sk_x"), "versioning"),
			402,
			{
				error: "upgrade_required",
				feature: "api_versioning",
				upgradeUrl: "https://marketing.test/pricing",
			},
		);
	});

	it("resolves { orgId, keyId } on the happy path (ungated scope)", async () => {
		const result = await requireApiKey(bearerHeaders("futu_sk_valid"), "mcp");
		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("futu_sk_valid");
		expect(result).toEqual({ orgId: "org-1", keyId: "key-1" });
	});

	it("resolves through the feature gate when the org has the feature", async () => {
		const result = await requireApiKey(
			bearerHeaders("futu_sk_valid"),
			"versioning",
		);
		expect(getOrgEntitlement).toHaveBeenCalledWith("org-1");
		expect(result).toEqual({ orgId: "org-1", keyId: "key-1" });
	});

	it("accepts the x-api-key header as a fallback", async () => {
		const result = await requireApiKey(
			new Headers({ "x-api-key": "futu_sk_header" }),
			"mcp",
		);
		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("futu_sk_header");
		expect(result).toEqual({ orgId: "org-1", keyId: "key-1" });
	});

	it("prefers the Bearer credential over x-api-key", async () => {
		await requireApiKey(
			new Headers({
				authorization: "Bearer futu_sk_bearer",
				"x-api-key": "futu_sk_header",
			}),
			"mcp",
		);
		expect(verifyApiKeyWithOwner).toHaveBeenCalledWith("futu_sk_bearer");
	});
});
