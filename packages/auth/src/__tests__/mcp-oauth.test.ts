import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@fuutu/env/saas", () => ({
	env: { BETTER_AUTH_URL: "https://app.example.com/" },
}));

vi.mock("better-auth/oauth2", () => ({
	verifyBearerToken: vi.fn(),
}));

const { verifyBearerToken } = await import("better-auth/oauth2");
const { authConfig } = await import("../config");
const { canServeMcpOAuth, getMcpOAuthUrls, mcpOAuth, verifyMcpAccessToken } =
	await import("../mcp-oauth");

describe("canServeMcpOAuth", () => {
	it.each([
		["https://app.example.com", true],
		["http://localhost:3000", true],
		["http://127.0.0.1:3000", true],
		["http://[::1]:3000", true],
		["http://10.0.0.5:3000", false],
		["http://app.example.com", false],
	])("%s → %s", (url, expected) => {
		expect(canServeMcpOAuth(url)).toBe(expected);
	});

	it("follows authConfig.mcpOAuth.enabled for an https app URL", () => {
		// Config-independent: your app may switch MCP OAuth off.
		expect(mcpOAuth.active).toBe(authConfig.mcpOAuth.enabled);
	});
});

describe("getMcpOAuthUrls", () => {
	it("derives issuer, resource, JWKS and metadata URLs from the app origin", () => {
		expect(getMcpOAuthUrls("https://app.example.com/")).toEqual({
			issuer: "https://app.example.com",
			resource: "https://app.example.com/api/mcp",
			jwksUrl: "https://app.example.com/api/auth/jwks",
			protectedResourceMetadataUrl:
				"https://app.example.com/.well-known/oauth-protected-resource/api/mcp",
		});
	});

	it("builds the RFC 9728 challenge pointing at the resource metadata", () => {
		expect(mcpOAuth.challenge).toBe(
			'Bearer resource_metadata="https://app.example.com/.well-known/oauth-protected-resource/api/mcp"',
		);
	});
});

describe("verifyMcpAccessToken", () => {
	beforeEach(() => {
		vi.mocked(verifyBearerToken).mockReset();
	});

	it("verifies against this app's issuer, the MCP audience and the JWKS", async () => {
		vi.mocked(verifyBearerToken).mockResolvedValue({ sub: "user-1" });
		await expect(verifyMcpAccessToken("token-1")).resolves.toEqual({
			sub: "user-1",
		});
		expect(verifyBearerToken).toHaveBeenCalledWith("token-1", {
			verifyOptions: {
				issuer: "https://app.example.com",
				audience: "https://app.example.com/api/mcp",
				requiredClaims: ["azp"],
			},
			jwksUrl: "https://app.example.com/api/auth/jwks",
		});
	});

	it("propagates verification failures (expired, bad signature, wrong audience)", async () => {
		vi.mocked(verifyBearerToken).mockRejectedValue(new Error("expired"));
		await expect(verifyMcpAccessToken("token-1")).rejects.toThrow("expired");
	});
});
