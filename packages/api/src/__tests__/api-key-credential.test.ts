import { beforeEach, describe, expect, it, vi } from "vitest";
import { verifyApiKeyCredential } from "../modules/api-keys/verify-credential";

vi.mock("@fuutu/db", () => ({
	verifyApiKeyWithOwner: vi.fn(),
	getOrganizationMemberRole: vi.fn(),
}));

// An app-defined vocabulary with one scope reserved for system admins.
vi.mock("../api-key-scopes", () => ({
	API_KEY_SCOPES: ["mcp", "versioning", "api", "internal"],
	API_KEY_ADMIN_SCOPES: ["internal"],
	API_SCOPE: "api",
}));

const { verifyApiKeyWithOwner, getOrganizationMemberRole } = await import(
	"@fuutu/db"
);

const owner = { id: "user-1", banned: false, role: "user" };
const orgKey = (scopes: string[]) => ({
	apiKey: { id: "key-1", organizationId: "org-1", scopes },
	user: owner,
});

describe("verifyApiKeyCredential", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getOrganizationMemberRole).mockResolvedValue("admin");
	});

	it("is null for an unknown, revoked or expired key", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(null);
		expect(await verifyApiKeyCredential("futu_sk_bad")).toBeNull();
	});

	it("is null when the owner is banned", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...orgKey(["mcp"]),
			user: { ...owner, banned: true },
		} as never);
		expect(await verifyApiKeyCredential("futu_sk_x")).toBeNull();
	});

	it("is null for an org key whose owner is no longer a member", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			orgKey(["mcp"]) as never,
		);
		vi.mocked(getOrganizationMemberRole).mockResolvedValue(null);
		expect(await verifyApiKeyCredential("futu_sk_x")).toBeNull();
		expect(getOrganizationMemberRole).toHaveBeenCalledWith("org-1", "user-1");
	});

	it("resolves an org key with the owner's current org role", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			orgKey(["mcp"]) as never,
		);
		const result = await verifyApiKeyCredential("futu_sk_ok");
		expect(result?.apiKey.id).toBe("key-1");
		expect(result?.orgRole).toBe("admin");
	});

	it("resolves a personal key without a membership lookup", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			apiKey: { id: "key-2", organizationId: null, scopes: [] },
			user: owner,
		} as never);
		const result = await verifyApiKeyCredential("futu_sk_ok");
		expect(result?.orgRole).toBeNull();
		expect(getOrganizationMemberRole).not.toHaveBeenCalled();
	});

	it("is null for an admin-scoped key once the owner is no longer a system admin", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			orgKey(["mcp", "internal"]) as never,
		);
		expect(await verifyApiKeyCredential("futu_sk_x")).toBeNull();
	});

	it("resolves an admin-scoped key while the owner is a system admin", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...orgKey(["internal"]),
			user: { ...owner, role: "admin" },
		} as never);
		expect(await verifyApiKeyCredential("futu_sk_ok")).not.toBeNull();
	});

	it("reads multi-role system roles (Better Auth stores 'admin,user')", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue({
			...orgKey(["internal"]),
			user: { ...owner, role: "user,admin" },
		} as never);
		expect(await verifyApiKeyCredential("futu_sk_ok")).not.toBeNull();
	});

	it("does not require system admin for keys without admin scopes", async () => {
		vi.mocked(verifyApiKeyWithOwner).mockResolvedValue(
			orgKey(["mcp", "api"]) as never,
		);
		expect(await verifyApiKeyCredential("futu_sk_ok")).not.toBeNull();
	});
});
