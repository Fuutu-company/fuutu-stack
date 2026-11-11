const BEARER_PREFIX = "bearer ";
// `${VAR}` sent literally by clients when the env var behind a committed
// MCP config header is unset — treat as "no credential", not as a bad key.
const UNEXPANDED_PLACEHOLDER = /^\$\{[^}]*\}$/;

/**
 * Reads the caller's credential: `Authorization: Bearer <token>` first,
 * then the optional fallback header (e.g. `x-api-key`). Returns `null`
 * when no usable credential was presented.
 */
export function extractBearerToken(
	headers: Headers,
	fallbackHeader?: string,
): string | null {
	const authorization = headers.get("authorization");
	let token: string | null = null;
	if (authorization?.toLowerCase().startsWith(BEARER_PREFIX)) {
		token = authorization.slice(BEARER_PREFIX.length).trim();
	}
	if (!token && fallbackHeader) {
		token = headers.get(fallbackHeader)?.trim() ?? null;
	}
	if (!token || UNEXPANDED_PLACEHOLDER.test(token)) return null;
	return token;
}
