/**
 * Guards around the MCP OAuth provider (`@better-auth/mcp`) for clients
 * registered through open dynamic client registration (RFC 7591).
 *
 * Anyone can register a client with any name and redirect URI, so:
 *  - registration bodies are size-capped (storage flooding);
 *  - such unverified clients never get a redirect back to their
 *    `redirect_uri` without the user interacting first. `prompt=none` and
 *    authorize errors would otherwise turn `/api/auth/oauth2/authorize`
 *    into an open redirect to an attacker-registered URI — they land on the
 *    app's own error page instead.
 */
import { getOAuthClientSummary, isUnverifiedOAuthClient } from "@fuutu/db";
import { APIError, isAPIError } from "better-auth/api";

export const MAX_REGISTRATION_BODY_BYTES = 16 * 1024;
const MAX_CLIENT_NAME_LENGTH = 100;
const MAX_REDIRECT_URIS = 5;
const MAX_REDIRECT_URI_LENGTH = 2048;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const registrationError = (error: string, description: string) =>
	new APIError("BAD_REQUEST", { error, error_description: description });

/**
 * Throws a 400 when a `/oauth2/register` body exceeds the caps. Shape and
 * semantics stay with the provider's own schema; only sizes are checked.
 */
export function assertRegistrationWithinLimits(
	body: unknown,
	contentLength: string | null | undefined,
): void {
	const declared = Number(contentLength);
	const size = Number.isFinite(declared) ? declared : 0;
	const serialized = new TextEncoder().encode(JSON.stringify(body ?? {}));
	if (
		size > MAX_REGISTRATION_BODY_BYTES ||
		serialized.byteLength > MAX_REGISTRATION_BODY_BYTES
	) {
		throw registrationError(
			"invalid_client_metadata",
			"registration request is too large",
		);
	}
	if (!isRecord(body)) return;

	const { client_name: clientName, redirect_uris: redirectUris } = body;
	if (
		typeof clientName === "string" &&
		clientName.length > MAX_CLIENT_NAME_LENGTH
	) {
		throw registrationError(
			"invalid_client_metadata",
			`client_name must be at most ${MAX_CLIENT_NAME_LENGTH} characters`,
		);
	}
	if (Array.isArray(redirectUris)) {
		if (redirectUris.length > MAX_REDIRECT_URIS) {
			throw registrationError(
				"invalid_redirect_uri",
				`at most ${MAX_REDIRECT_URIS} redirect_uris are allowed`,
			);
		}
		if (
			redirectUris.some(
				(uri) =>
					typeof uri === "string" && uri.length > MAX_REDIRECT_URI_LENGTH,
			)
		) {
			throw registrationError(
				"invalid_redirect_uri",
				`redirect_uris must be at most ${MAX_REDIRECT_URI_LENGTH} characters`,
			);
		}
	}
}

/**
 * Authorization request parameters: the query (GET, and authorize resumed
 * after sign-in/consent, where the body is the sign-in body) or a
 * form-POSTed authorize body.
 */
export function getAuthorizeParams(
	query: unknown,
	body: unknown,
): Record<string, unknown> {
	if (isRecord(query) && typeof query.client_id === "string") return query;
	if (isRecord(body) && typeof body.client_id === "string") return body;
	return {};
}

export function buildErrorPageUrl(
	errorPageUrl: string,
	error: string,
	description: string,
): string {
	const url = new URL(errorPageUrl);
	url.searchParams.set("error", error);
	url.searchParams.set("error_description", description);
	return url.toString();
}

async function isUnverifiedClientId(clientId: unknown): Promise<boolean> {
	if (typeof clientId !== "string" || !clientId) return false;
	const client = await getOAuthClientSummary(clientId);
	return client !== null && isUnverifiedOAuthClient(client);
}

/**
 * `prompt=none` asks for a redirect back to the client without any user
 * interaction — refused for unverified clients. Returns the app error page
 * URL to send the browser to, or `null` to let the provider continue.
 */
export async function getPromptNoneBlockUrl(
	params: Record<string, unknown>,
	errorPageUrl: string,
): Promise<string | null> {
	const prompt = typeof params.prompt === "string" ? params.prompt : "";
	if (!prompt.split(" ").includes("none")) return null;
	if (!(await isUnverifiedClientId(params.client_id))) return null;
	return buildErrorPageUrl(
		errorPageUrl,
		"interaction_required",
		"prompt=none is not available for unverified clients",
	);
}

type RedirectResult = { url: string; mode: "redirect" | "json" };

/**
 * Where an authorize result sends the browser: a thrown `ctx.redirect`
 * (302 `APIError` with `location`) or the `{ redirect, url }` JSON the
 * provider returns to fetch callers.
 */
function readRedirect(returned: unknown): RedirectResult | null {
	// `isAPIError`, not `instanceof`: `ctx.redirect()` throws better-call's
	// base class, which better-auth's `APIError` only extends.
	if (isAPIError(returned)) {
		if (returned.statusCode < 300 || returned.statusCode >= 400) return null;
		const location = new Headers(returned.headers).get("location");
		return location ? { url: location, mode: "redirect" } : null;
	}
	if (
		isRecord(returned) &&
		returned.redirect === true &&
		typeof returned.url === "string"
	) {
		return { url: returned.url, mode: "json" };
	}
	return null;
}

/**
 * An authorize error redirect to an unverified client's `redirect_uri`
 * (any off-origin target carrying `error`, in query or fragment) is
 * replaced by the app error page. Returns the replacement or `null`.
 */
export async function getUnverifiedErrorRedirect(input: {
	returned: unknown;
	params: Record<string, unknown>;
	appOrigin: string;
	errorPageUrl: string;
}): Promise<RedirectResult | null> {
	const redirect = readRedirect(input.returned);
	if (!redirect) return null;

	let target: URL;
	try {
		target = new URL(redirect.url, input.appOrigin);
	} catch {
		return null;
	}
	if (target.origin === input.appOrigin) return null;
	const fragment = new URLSearchParams(target.hash.slice(1));
	const error = target.searchParams.get("error") ?? fragment.get("error");
	if (!error) return null;
	if (!(await isUnverifiedClientId(input.params.client_id))) return null;

	const description =
		target.searchParams.get("error_description") ??
		fragment.get("error_description") ??
		"";
	return {
		url: buildErrorPageUrl(input.errorPageUrl, error, description),
		mode: redirect.mode,
	};
}
