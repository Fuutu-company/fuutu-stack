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
 * ```ts
 * export const APP_PUBLIC_PREFIXES: readonly string[] = [
 *   // reason: partner webhook — HMAC signature verified in the handler
 *   "/api/partner-hooks",
 * ];
 * ```
 */
export const APP_PUBLIC_PREFIXES: readonly string[] = [];
