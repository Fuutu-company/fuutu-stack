import type { PublicPathEntry } from "@fuutu/utils/public-path";

/**
 * App-owned public route prefixes — paths the saas proxy lets through
 * without the optimistic login redirect (appended to the kit's list in
 * `proxy.ts`; add yours here instead of editing that file).
 *
 * Public here only means "no session cookie required": the route must
 * authenticate itself (signed webhook, API key via `requireApiKey`, shared
 * secret) or be public by design. Every entry needs a `// reason:` comment
 * that says which — enforced by the proxy-public arch guard:
 *
 * An entry is a string (prefix match: `"/api/partner-hooks"` also covers
 * `/api/partner-hooks/x`) or `{ exact: "/path" }` (that path only):
 *
 * ```ts
 * export const APP_PUBLIC_PREFIXES: readonly PublicPathEntry[] = [
 *   // reason: partner webhook — HMAC signature verified in the handler
 *   "/api/partner-hooks",
 *   // reason: public status page — read-only, no user data
 *   { exact: "/status" },
 * ];
 * ```
 */
export const APP_PUBLIC_PREFIXES: readonly PublicPathEntry[] = [];
