import {
	MCP_ORG_CLAIM,
	mcpOAuth,
	verifyMcpAccessToken,
} from "@fuutu/auth/mcp-oauth";
import {
	API_KEY_PREFIX,
	getOrganizationWithMembers,
	getUserById,
} from "@fuutu/db";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import { extractBearerToken, type McpPrincipal } from "@fuutu/mcp";
import { z } from "zod";
import { apiConfig } from "../config";
import { API_KEY_HEADER } from "../context";
import { findMissingScopeFeature } from "../modules/api-keys/scope-feature";
import { verifyApiKeyCredential } from "../modules/api-keys/verify-credential";

/** API-key scope that unlocks the MCP endpoint (see `API_KEY_SCOPES`). */
export const MCP_SCOPE = "mcp";

const log = createLogger({ scope: "mcp-auth" });

/**
 * `WWW-Authenticate` for MCP 401s. With OAuth enabled it is the RFC 9728
 * pointer to the protected-resource metadata — MCP clients only start the
 * OAuth flow after such a 401.
 */
export function getMcpChallenge(): string {
	return mcpOAuth.active ? mcpOAuth.challenge : 'Bearer realm="mcp"';
}

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			...(status === 401 ? { "www-authenticate": getMcpChallenge() } : {}),
		},
	});

const accessTokenClaimsSchema = z.object({
	sub: z.string().min(1),
	scope: z.string().optional(),
	jti: z.string().min(1).optional(),
	azp: z.string().min(1),
	[MCP_ORG_CLAIM]: z.string().min(1).optional(),
});

/**
 * Resolves the MCP caller. No credential → anonymous; a presented but
 * unusable credential → 401, never a silent downgrade.
 *
 * - Org API key (`futu_sk_…` bearer or `x-api-key`) carrying the `mcp`
 *   scope — same rules as `requireApiKey` (owner not banned, still a member
 *   of the key's org, still a system admin for admin-scoped keys).
 * - Any other bearer, when MCP OAuth is active (`mcpOAuth.active`) → OAuth access
 *   token issued by Better Auth for this MCP resource.
 */
export async function resolveMcpPrincipal(
	request: Request,
): Promise<McpPrincipal | Response> {
	const bearer = extractBearerToken(request.headers);
	if (mcpOAuth.active && bearer && !bearer.startsWith(API_KEY_PREFIX)) {
		return resolveOAuthPrincipal(bearer);
	}

	const rawKey = bearer ?? extractBearerToken(request.headers, API_KEY_HEADER);
	if (!rawKey) return { kind: "anonymous" };

	// Owner ban, org membership and admin-scope role are re-checked on
	// every request (verifyApiKeyCredential) — fail closed.
	const verified = await verifyApiKeyCredential(rawKey);
	if (!verified) return json(401, { error: "invalid_api_key" });
	const { apiKey, user, orgRole } = verified;
	if (
		!apiKey.organizationId ||
		orgRole === null ||
		!apiKey.scopes.includes(MCP_SCOPE)
	) {
		return json(401, { error: "invalid_api_key" });
	}

	const missing = await findMissingScopeFeature(
		apiKey.organizationId,
		MCP_SCOPE,
	);
	if (missing) {
		return json(402, { error: "upgrade_required", ...missing });
	}

	return {
		kind: "user",
		via: "api-key",
		credentialId: apiKey.id,
		userId: user.id,
		organizationId: apiKey.organizationId,
		orgRole,
		systemRole: user.role ?? null,
		scopes: apiKey.scopes,
	};
}

async function resolveOAuthPrincipal(
	token: string,
): Promise<McpPrincipal | Response> {
	let rawClaims: unknown;
	try {
		rawClaims = await verifyMcpAccessToken(token);
	} catch (err) {
		log.info("mcp access token rejected", { err: String(err) });
		return json(401, { error: "invalid_token" });
	}
	const parsed = accessTokenClaimsSchema.safeParse(rawClaims);
	if (!parsed.success) return json(401, { error: "invalid_token" });
	const claims = parsed.data;

	const user = await getUserById(claims.sub);
	if (!user || user.banned) return json(401, { error: "invalid_token" });

	// The org claim is the user's active organization at consent time —
	// re-checked here so a removed member keeps no org access.
	let organizationId: string | null = null;
	let orgRole: string | null = null;
	const claimedOrgId = claims[MCP_ORG_CLAIM];
	if (claimedOrgId) {
		const org = await getOrganizationWithMembers(claimedOrgId);
		const member = org?.members.find((m) => m.userId === user.id);
		if (member) {
			organizationId = claimedOrgId;
			orgRole = member.role;
		}
	}

	if (organizationId) {
		const missing = await findMissingScopeFeature(organizationId, MCP_SCOPE);
		if (missing) {
			return json(402, { error: "upgrade_required", ...missing });
		}
	} else {
		// A plan-gated MCP needs an org entitlement: without an org (consent
		// given in no org, or membership since dropped) there is none — a
		// user-only principal would bypass the gate.
		const feature = apiConfig.apiKeyScopeFeatures[MCP_SCOPE];
		if (feature) {
			// Same upgrade URL as `findMissingScopeFeature`.
			const upgradeUrl = env.NEXT_PUBLIC_MARKETING_URL
				? `${env.NEXT_PUBLIC_MARKETING_URL}/pricing`
				: "/pricing";
			return json(402, { error: "upgrade_required", feature, upgradeUrl });
		}
	}

	return {
		kind: "user",
		via: "oauth",
		credentialId: claims.jti ?? claims.azp,
		userId: user.id,
		organizationId,
		orgRole,
		systemRole: user.role ?? null,
		scopes: claims.scope?.split(" ").filter(Boolean) ?? [],
	};
}
