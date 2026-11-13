import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { API_KEY_HEADER } from "../../context";
import { findMissingScopeFeature } from "./scope-feature";
import { verifyApiKeyCredential } from "./verify-credential";

const jsonResponse = (status: number, body: Record<string, unknown>) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const httpError = (
	status: ContentfulStatusCode,
	body: Record<string, unknown>,
) => new HTTPException(status, { res: jsonResponse(status, body) });

const BEARER_PREFIX = "bearer ";

/**
 * Extract the API-key credential from request headers.
 * `authorization: Bearer <key>` wins; the kit's `x-api-key` header
 * (see context.ts) is the fallback.
 */
const extractApiKey = (headers: Headers): string | null => {
	const authorization = headers.get("authorization");
	if (authorization?.toLowerCase().startsWith(BEARER_PREFIX)) {
		const token = authorization.slice(BEARER_PREFIX.length).trim();
		if (token) return token;
	}
	return headers.get(API_KEY_HEADER);
};

/**
 * Guard for scope-protected API endpoints outside the oRPC session
 * context. Verifies the presented API key, requires it to be an
 * organization key carrying the requested scope, and enforces the
 * per-scope feature gate from `apiConfig.apiKeyScopeFeatures`.
 *
 * Throws HTTPException:
 *  - 401 { error: "missing_api_key" }   — no credential presented
 *  - 401 { error: "invalid_api_key" }   — unknown/revoked/expired key,
 *    user-scoped key, banned owner, owner no longer a member of the key's
 *    org, admin-scoped key of a former system admin, or key lacking the
 *    scope (see verifyApiKeyCredential)
 *  - 402 { error: "upgrade_required" }  — scope is feature-gated and the
 *    org's entitlement lacks the mapped feature
 *
 * Every call with a credential costs a DB lookup, valid or not — run it
 * through `throttlePreAuth(headers, "<route>")` (`../../pre-auth-throttle`)
 * so random-key floods get 429 before reaching it.
 */
export const requireApiKey = async (
	headers: Headers,
	scope: string,
): Promise<{ orgId: string; keyId: string }> => {
	const rawKey = extractApiKey(headers);
	if (!rawKey) {
		throw httpError(401, { error: "missing_api_key" });
	}

	const verified = await verifyApiKeyCredential(rawKey);
	const apiKey = verified?.apiKey;
	if (!apiKey?.organizationId) {
		throw httpError(401, { error: "invalid_api_key" });
	}
	if (!apiKey.scopes.includes(scope)) {
		throw httpError(401, { error: "invalid_api_key" });
	}

	const missing = await findMissingScopeFeature(apiKey.organizationId, scope);
	if (missing) {
		throw httpError(402, { error: "upgrade_required", ...missing });
	}

	return { orgId: apiKey.organizationId, keyId: apiKey.id };
};
