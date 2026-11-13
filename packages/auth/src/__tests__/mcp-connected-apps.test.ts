import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/db", () => ({
	listOAuthConnectedApps: vi.fn(),
	revokeOAuthClientAccess: vi.fn(),
}));

const { listOAuthConnectedApps, revokeOAuthClientAccess } = await import(
	"@fuutu/db"
);
const { listConnectedApps, revokeConnectedApp, mcpConnectedApps } =
	await import("../plugins/mcp-connected-apps");

describe("listConnectedApps", () => {
	it("lists the session user's apps with an ISO grant date", async () => {
		vi.mocked(listOAuthConnectedApps).mockResolvedValue([
			{
				clientId: "c1",
				name: "Claude",
				uri: null,
				unverified: true,
				grantedAt: new Date("2026-11-01T10:00:00Z"),
				scopes: ["openid", "offline_access"],
				organizations: ["Acme"],
			},
		]);
		expect(await listConnectedApps("user-1")).toEqual([
			{
				clientId: "c1",
				name: "Claude",
				uri: null,
				unverified: true,
				grantedAt: "2026-11-01T10:00:00.000Z",
				scopes: ["openid", "offline_access"],
				organizations: ["Acme"],
			},
		]);
		expect(listOAuthConnectedApps).toHaveBeenCalledWith("user-1");
	});
});

describe("revokeConnectedApp", () => {
	beforeEach(() => {
		vi.mocked(revokeOAuthClientAccess).mockReset();
		vi.mocked(revokeOAuthClientAccess).mockResolvedValue({
			accessTokens: 0,
			refreshTokens: 1,
			consents: 1,
		});
	});

	it("revokes consent + tokens of that client for the session user only", async () => {
		await revokeConnectedApp("user-1", { clientId: "c1" });
		expect(revokeOAuthClientAccess).toHaveBeenCalledWith("user-1", "c1");
	});

	it.each([
		[{}],
		[{ clientId: "" }],
		[{ clientId: 42 }],
		[{ clientId: "x".repeat(256) }],
		[null],
	])("rejects a malformed body %o with 400", async (body) => {
		await expect(revokeConnectedApp("user-1", body)).rejects.toMatchObject({
			statusCode: 400,
		});
		await expect(revokeConnectedApp("user-1", body)).rejects.toBeInstanceOf(
			APIError,
		);
		expect(revokeOAuthClientAccess).not.toHaveBeenCalled();
	});

	it("answers 404 when the user had no grant for that client", async () => {
		vi.mocked(revokeOAuthClientAccess).mockResolvedValue({
			accessTokens: 0,
			refreshTokens: 0,
			consents: 0,
		});
		await expect(
			revokeConnectedApp("user-1", { clientId: "c-unknown" }),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});

describe("mcpConnectedApps plugin", () => {
	it("rate-limits the revoke endpoint", () => {
		const plugin = mcpConnectedApps();
		const rule = plugin.rateLimit.find((r) =>
			r.pathMatcher("/mcp-oauth/connected-apps/revoke"),
		);
		expect(rule).toBeDefined();
		expect(rule?.pathMatcher("/mcp-oauth/connected-apps")).toBe(false);
	});
});
