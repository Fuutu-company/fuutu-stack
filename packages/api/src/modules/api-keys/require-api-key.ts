import { verifyApiKeyWithOwner } from "@fuutu/db";
import { env } from "@fuutu/env/saas";
import { getOrgEntitlement } from "@fuutu/payments";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { apiConfig } from "../../config";
import { API_KEY_HEADER } from "../../context";

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
 *    user-scoped key, banned owner, or key lacking the scope
 *  - 402 { error: "upgrade_required" }  — scope is feature-gated and the
 *    org's entitlement lacks the mapped feature
 */
export const requireApiKey = async (
	headers: Headers,
	scope: string,
): Promise<{ orgId: string; keyId: string }> => {
	const rawKey = extractApiKey(headers);
	if (!rawKey) {
		throw httpError(401, { error: "missing_api_key" });
	}

	const verified = await verifyApiKeyWithOwner(rawKey);
	const apiKey = verified?.apiKey;
	if (!apiKey?.organizationId || verified?.user.banned) {
		throw httpError(401, { error: "invalid_api_key" });
	}
	if (!apiKey.scopes.includes(scope)) {
		throw httpError(401, { error: "invalid_api_key" });
	}

	const feature = apiConfig.apiKeyScopeFeatures[scope];
	if (feature) {
		const entitlement = await getOrgEntitlement(apiKey.organizationId);
		if (!entitlement.features.includes(feature)) {
			const upgradeUrl = env.NEXT_PUBLIC_MARKETING_URL
				? `${env.NEXT_PUBLIC_MARKETING_URL}/pricing`
				: "/pricing";
			throw httpError(402, {
				error: "upgrade_required",
				feature,
				upgradeUrl,
			});
		}
	}

	return { orgId: apiKey.organizationId, keyId: apiKey.id };
};
