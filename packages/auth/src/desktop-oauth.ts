import { config } from "@fuutu/config";
import { clearDesktopOAuthConsents, ensureDesktopOAuthClient } from "@fuutu/db";
import { desktopConfig } from "@fuutu/desktop/config";
import { desktopIdentity } from "@fuutu/desktop/identity";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { APIError } from "better-auth/api";
import { verifyBearerToken } from "better-auth/oauth2";
import { mcpOAuth } from "./mcp-oauth";

/**
 * The desktop app as an OAuth 2.1 client of this backend
 * (`config.features.desktop`), on the same Better Auth provider as MCP but
 * with its OWN audience (security condition C1):
 *
 * - resource / audience `<origin>/api/rpc` — never the `/api/mcp` audience,
 *   so an MCP token (from any self-registered client) is rejected here and
 *   a desktop token is rejected by `/api/mcp`;
 * - one pre-registered public client (`desktopIdentity.oauthClientId`,
 *   PKCE, no secret, with a consent screen — RFC 8252 §8.6), linked to
 *   that resource only. Better Auth enforces per-client resource links
 *   (`enforcePerClientResources`, default on) and dynamic registration only
 *   links new clients to the MCP resource, so no other client can obtain a
 *   desktop-audience token;
 * - redirect: loopback `http://127.0.0.1/callback` on any port (RFC 8252
 *   §7.3 — Better Auth 1.7.15 matches loopback redirects port-agnostic) or
 *   the deep link `<scheme>://auth/callback`.
 */

/** Access-token claim with the organization active at sign-in. */
export const DESKTOP_ORG_CLAIM = "org_id";

/** Scopes the desktop client asks for (refresh via `offline_access`). */
export const DESKTOP_SCOPES = ["openid", "profile", "email", "offline_access"];

export function getDesktopOAuthUrls(baseUrl: string) {
	const origin = new URL(baseUrl).origin;
	return {
		issuer: origin,
		resource: `${origin}/api/rpc`,
		jwksUrl: `${origin}/api/auth/jwks`,
	};
}

export function desktopRedirectUris(scheme = desktopIdentity.scheme): string[] {
	return ["http://127.0.0.1/callback", `${scheme}://auth/callback`];
}

const urls = getDesktopOAuthUrls(env.BETTER_AUTH_URL ?? "http://localhost");

export const desktopOAuth = {
	...urls,
	clientId: desktopIdentity.oauthClientId,
	/**
	 * Desktop switch on, desktop auth not `off`, and the OAuth provider
	 * running (`mcpOAuth.active`: https or loopback app URL).
	 */
	active:
		config.features.desktop && desktopConfig.auth !== "off" && mcpOAuth.active,
};

let ensured: Promise<void> | null = null;

/**
 * Registers / refreshes the desktop client once per process — lazily, on
 * the first authorize or token request, so a backend that never sees a
 * desktop app never writes it.
 */
export function ensureDesktopClient(): Promise<void> {
	if (!desktopOAuth.active) return Promise.resolve();
	ensured ??= ensureDesktopOAuthClient({
		clientId: desktopOAuth.clientId,
		name: desktopIdentity.productName,
		redirectUris: desktopRedirectUris(),
		scopes: DESKTOP_SCOPES,
		resource: desktopOAuth.resource,
	}).catch((err) => {
		ensured = null;
		createLogger({ scope: "auth" }).error("desktop OAuth client setup failed", {
			err: String(err),
		});
		throw err;
	});
	return ensured;
}

export type DesktopAccessTokenClaims = Awaited<
	ReturnType<typeof verifyBearerToken>
>;

/**
 * Verifies a desktop access token: signature (JWKS), issuer, audience =
 * the desktop resource, expiry, and `azp` = the desktop client. Throws when
 * invalid or when the desktop module is off.
 */
export async function verifyDesktopAccessToken(
	token: string,
): Promise<DesktopAccessTokenClaims> {
	if (!desktopOAuth.active) throw new Error("desktop OAuth is off");
	const claims = await verifyBearerToken(token, {
		verifyOptions: {
			issuer: desktopOAuth.issuer,
			audience: desktopOAuth.resource,
			requiredClaims: ["azp", "sub"],
		},
		jwksUrl: desktopOAuth.jwksUrl,
	});
	if ((claims as { azp?: unknown }).azp !== desktopOAuth.clientId) {
		throw new Error("token was not issued to the desktop client");
	}
	return claims;
}

/**
 * `/oauth2/authorize` and `/oauth2/token` for the desktop client: refused
 * while the desktop module is off (a client row left from an earlier "on"
 * stays unusable without a DB write), and an authorization must ask for
 * `offline_access` — every signed-in install holds a refresh token, which
 * is what the device list and `devices.limit` count.
 */
export function assertDesktopClientRequest(
	path: string,
	params: Record<string, unknown>,
): void {
	if (params.client_id !== desktopOAuth.clientId) return;
	if (!desktopOAuth.active) {
		throw new APIError("BAD_REQUEST", {
			error: "invalid_client",
			error_description: "client is disabled",
		});
	}
	if (path !== "/oauth2/authorize") return;
	const scopes =
		typeof params.scope === "string" ? params.scope.split(" ") : [];
	if (!scopes.includes("offline_access")) {
		throw new APIError("BAD_REQUEST", {
			error: "invalid_scope",
			error_description: "the desktop app must request offline_access",
		});
	}
}

/**
 * The desktop client is public: any local program can use its client id
 * and a loopback redirect (RFC 8252 §8.6). So a stored consent never
 * carries over to the next sign-in: after every desktop authorization-code
 * exchange the client's consents are cleared — every sign-in shows the
 * consent screen and needs the user's click. (Forcing `prompt=consent`
 * instead loops: Better Auth re-runs authorize, hooks included, after the
 * consent is given.)
 */
export async function clearDesktopConsentAfterSignIn(input: {
	path: string;
	body: unknown;
}): Promise<void> {
	if (!desktopOAuth.active || input.path !== "/oauth2/token") return;
	const body = (input.body ?? {}) as Record<string, unknown>;
	if (
		body.client_id !== desktopOAuth.clientId ||
		body.grant_type !== "authorization_code"
	) {
		return;
	}
	// Also after a failed exchange: the worst case is one more consent
	// screen (the shape of `returned` differs by Better Auth response type).
	await clearDesktopOAuthConsents(desktopOAuth.clientId);
}
