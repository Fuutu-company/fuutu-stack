import { getOrganizationWithMembers, verifyApiKeyWithOwner } from "@fuutu/db";
import { extractBearerToken, type McpPrincipal } from "@fuutu/mcp";
import { API_KEY_HEADER } from "../context";
import { findMissingScopeFeature } from "../modules/api-keys/scope-feature";

/** API-key scope that unlocks the MCP endpoint (see `API_KEY_SCOPES`). */
export const MCP_SCOPE = "mcp";

const json = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			...(status === 401 ? { "www-authenticate": 'Bearer realm="mcp"' } : {}),
		},
	});

/**
 * Resolves the MCP caller from an organization API key carrying the
 * `mcp` scope (same rules as `requireApiKey`). No credential → anonymous;
 * a presented but unusable credential → 401, never a silent downgrade.
 *
 * OAuth (Better Auth as authorization server) can be added here later as
 * a second `via` without touching tools.
 */
export async function resolveMcpPrincipal(
	request: Request,
): Promise<McpPrincipal | Response> {
	const rawKey = extractBearerToken(request.headers, API_KEY_HEADER);
	if (!rawKey) return { kind: "anonymous" };

	const verified = await verifyApiKeyWithOwner(rawKey);
	if (!verified) return json(401, { error: "invalid_api_key" });
	const { apiKey, user } = verified;
	if (
		!apiKey.organizationId ||
		user.banned ||
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

	const org = await getOrganizationWithMembers(apiKey.organizationId);
	const member = org?.members.find((m) => m.userId === user.id);
	if (!member) {
		return json(401, { error: "invalid_api_key" });
	}

	return {
		kind: "user",
		via: "api-key",
		credentialId: apiKey.id,
		userId: user.id,
		organizationId: apiKey.organizationId,
		orgRole: member.role,
		systemRole: user.role ?? null,
		scopes: apiKey.scopes,
	};
}
