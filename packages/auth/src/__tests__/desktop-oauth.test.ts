import { generateKeyPairSync, sign } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Security condition C1: the desktop API has its own audience. Real
 * signatures (Ed25519, like Better Auth's JWKS) — only the JWKS fetch is
 * stubbed — so audience, issuer, azp and expiry checks are the real ones.
 */

vi.mock("@fuutu/env/saas", () => ({
	env: { BETTER_AUTH_URL: "https://app.example.com/" },
}));
vi.mock("@fuutu/config", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@fuutu/config")>();
	return {
		...actual,
		config: {
			...actual.config,
			features: { ...actual.config.features, desktop: true },
		},
	};
});
vi.mock("@fuutu/db", () => ({
	ensureDesktopOAuthClient: vi.fn(),
	clearDesktopOAuthConsents: vi.fn(),
}));

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const jwk = {
	...publicKey.export({ format: "jwk" }),
	kid: "k1",
	alg: "EdDSA",
	use: "sig",
};

const b64 = (value: object) =>
	Buffer.from(JSON.stringify(value)).toString("base64url");
function jwt(claims: Record<string, unknown>): string {
	const now = Math.floor(Date.now() / 1000);
	const head = b64({ alg: "EdDSA", kid: "k1", typ: "JWT" });
	const body = b64({ iat: now, exp: now + 3600, ...claims });
	const signature = sign(null, Buffer.from(`${head}.${body}`), privateKey);
	return `${head}.${body}.${signature.toString("base64url")}`;
}

const ISSUER = "https://app.example.com";
const DESKTOP_AUD = "https://app.example.com/api/rpc";
const MCP_AUD = "https://app.example.com/api/mcp";

beforeAll(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (url: string | URL) =>
			String(url).endsWith("/api/auth/jwks")
				? new Response(JSON.stringify({ keys: [jwk] }), {
						headers: { "content-type": "application/json" },
					})
				: new Response(null, { status: 404 }),
		),
	);
});
afterAll(() => vi.unstubAllGlobals());

const { desktopOAuth, desktopRedirectUris, verifyDesktopAccessToken } =
	await import("../desktop-oauth");
const { verifyMcpAccessToken } = await import("../mcp-oauth");

const desktopClaims = () => ({
	iss: ISSUER,
	aud: DESKTOP_AUD,
	sub: "user-1",
	azp: desktopOAuth.clientId,
});

describe("desktop OAuth audience (C1)", () => {
	it("uses its own resource, never the MCP one", () => {
		expect(desktopOAuth.resource).toBe(DESKTOP_AUD);
		expect(desktopOAuth.resource).not.toBe(MCP_AUD);
		expect(desktopOAuth.active).toBe(true);
	});

	it("accepts a desktop token for the desktop client", async () => {
		await expect(
			verifyDesktopAccessToken(jwt(desktopClaims())),
		).resolves.toMatchObject({
			sub: "user-1",
		});
	});

	it("accepts the userinfo audience alongside (openid scope)", async () => {
		const token = jwt({
			...desktopClaims(),
			aud: [DESKTOP_AUD, `${ISSUER}/api/auth/oauth2/userinfo`],
		});
		await expect(verifyDesktopAccessToken(token)).resolves.toBeTruthy();
	});

	it("rejects an MCP-audience token on the desktop API", async () => {
		const token = jwt({ ...desktopClaims(), aud: MCP_AUD });
		await expect(verifyDesktopAccessToken(token)).rejects.toThrow();
	});

	it("rejects a desktop-audience token on /api/mcp", async () => {
		await expect(verifyMcpAccessToken(jwt(desktopClaims()))).rejects.toThrow();
	});

	it("rejects a desktop-audience token issued to another client", async () => {
		const token = jwt({ ...desktopClaims(), azp: "self-registered-client" });
		await expect(verifyDesktopAccessToken(token)).rejects.toThrow(
			/desktop client/,
		);
	});

	it("rejects expired tokens, foreign issuers and forged signatures", async () => {
		const past = Math.floor(Date.now() / 1000) - 10;
		await expect(
			verifyDesktopAccessToken(jwt({ ...desktopClaims(), exp: past })),
		).rejects.toThrow();
		await expect(
			verifyDesktopAccessToken(
				jwt({ ...desktopClaims(), iss: "https://evil.example" }),
			),
		).rejects.toThrow();
		const [head, body] = jwt(desktopClaims()).split(".");
		await expect(
			verifyDesktopAccessToken(`${head}.${body}.AAAA`),
		).rejects.toThrow();
	});

	it("registers loopback (any port, RFC 8252) and deep-link redirects", () => {
		expect(desktopRedirectUris("acme")).toEqual([
			"http://127.0.0.1/callback",
			"acme://auth/callback",
		]);
	});
});

describe("assertDesktopClientRequest", () => {
	it("requires offline_access on the desktop client's authorize", async () => {
		const { assertDesktopClientRequest, desktopOAuth } = await import(
			"../desktop-oauth"
		);
		const client_id = desktopOAuth.clientId;
		expect(() =>
			assertDesktopClientRequest("/oauth2/authorize", {
				client_id,
				scope: "openid profile email",
			}),
		).toThrow(
			expect.objectContaining({
				body: expect.objectContaining({ error: "invalid_scope" }),
			}),
		);
		expect(() =>
			assertDesktopClientRequest("/oauth2/authorize", {
				client_id,
				scope: "openid offline_access",
			}),
		).not.toThrow();
		// Token requests and other clients are not affected.
		expect(() =>
			assertDesktopClientRequest("/oauth2/token", { client_id }),
		).not.toThrow();
		expect(() =>
			assertDesktopClientRequest("/oauth2/authorize", {
				client_id: "mcp-client",
				scope: "openid",
			}),
		).not.toThrow();
	});
});

describe("clearDesktopConsentAfterSignIn", () => {
	it("clears the desktop client's consents after its code exchanges only", async () => {
		const { clearDesktopConsentAfterSignIn, desktopOAuth } = await import(
			"../desktop-oauth"
		);
		const { clearDesktopOAuthConsents } = await import("@fuutu/db");
		const client_id = desktopOAuth.clientId;
		await clearDesktopConsentAfterSignIn({
			path: "/oauth2/token",
			body: { client_id, grant_type: "refresh_token" },
		});
		await clearDesktopConsentAfterSignIn({
			path: "/oauth2/token",
			body: { client_id: "mcp", grant_type: "authorization_code" },
		});
		await clearDesktopConsentAfterSignIn({
			path: "/oauth2/authorize",
			body: { client_id, grant_type: "authorization_code" },
		});
		expect(clearDesktopOAuthConsents).not.toHaveBeenCalled();
		await clearDesktopConsentAfterSignIn({
			path: "/oauth2/token",
			body: { client_id, grant_type: "authorization_code" },
		});
		expect(clearDesktopOAuthConsents).toHaveBeenCalledWith(client_id);
	});
});
