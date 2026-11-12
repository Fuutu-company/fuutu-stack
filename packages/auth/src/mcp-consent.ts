import { verifyOAuthQueryParams } from "@better-auth/oauth-provider";
import {
	getOAuthClientSummary,
	getOrganizationById,
	isUnverifiedOAuthClient,
} from "@fuutu/db";

/** What the consent page shows — read server-side, never from the client. */
export type McpConsentRequest = {
	/** Self-asserted for unverified clients — never the only signal shown. */
	clientName: string | null;
	/** Host of the registered `client_uri` (http/https only). */
	clientHost: string | null;
	/** Host of the signed `redirect_uri` the authorization code goes to. */
	redirectHost: string;
	unverified: boolean;
	organizationName: string | null;
	scopes: string[];
};

type SearchParams = Record<string, string | string[] | undefined>;

const SIGNED_PARAM_NAMES = "ba_param";

/** Mirrors the provider client's `buildSignedOAuthQuery`. */
function toSignedQuery(params: SearchParams): URLSearchParams {
	const all = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		for (const v of Array.isArray(value) ? value : value ? [value] : []) {
			all.append(key, v);
		}
	}
	const signedNames = new Set(all.getAll(SIGNED_PARAM_NAMES));
	const signed = new URLSearchParams();
	for (const [key, value] of all.entries()) {
		if (key === "sig" || key === SIGNED_PARAM_NAMES || signedNames.has(key)) {
			signed.append(key, value);
		}
	}
	return signed;
}

function httpHost(uri: string | null): string | null {
	if (!uri) return null;
	try {
		const url = new URL(uri);
		return url.protocol === "https:" || url.protocol === "http:"
			? url.host
			: null;
	} catch {
		return null;
	}
}

/**
 * Resolves the consent page's signed authorization request: verifies the
 * provider's signature + expiry (so the shown `redirect_uri` is the one the
 * code will go to), then loads the client and active organization.
 * Returns `null` for anything invalid.
 */
export async function resolveMcpConsentRequest(
	params: SearchParams,
	input: { activeOrganizationId: string | null | undefined; secret: string },
): Promise<McpConsentRequest | null> {
	const query = toSignedQuery(params);
	if (!(await verifyOAuthQueryParams(query.toString(), input.secret))) {
		return null;
	}
	const clientId = query.get("client_id");
	const redirectUri = query.get("redirect_uri");
	if (!clientId || !redirectUri) return null;

	let redirect: URL;
	try {
		redirect = new URL(redirectUri);
	} catch {
		return null;
	}

	const client = await getOAuthClientSummary(clientId);
	if (!client || client.disabled) return null;

	const organization = input.activeOrganizationId
		? await getOrganizationById(input.activeOrganizationId)
		: null;

	return {
		clientName: client.name,
		clientHost: httpHost(client.uri),
		redirectHost: redirect.host || redirect.protocol,
		unverified: isUnverifiedOAuthClient(client),
		organizationName: organization?.name ?? null,
		scopes: (query.get("scope") ?? "").split(" ").filter(Boolean),
	};
}

/** `resolveMcpConsentRequest` with the auth secret the provider signs with. */
export async function getMcpConsentRequest(
	params: SearchParams,
	activeOrganizationId: string | null | undefined,
): Promise<McpConsentRequest | null> {
	const { auth } = await import("./index");
	const { secret } = await auth.$context;
	return resolveMcpConsentRequest(params, { activeOrganizationId, secret });
}
