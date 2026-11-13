/**
 * API-key scope vocabulary — the single place to configure which scopes an
 * org API key may carry (`ApiKey.scopes`). `apiConfig.apiKeyScopes` /
 * `apiConfig.apiKeyAdminScopes` expose these values server-side; this file
 * stays a pure module so client components (the create dialog) can import
 * it without server-only deps.
 *
 * A scoped key is only usable on the surfaces of its scopes:
 * `requireApiKey(headers, scope)` admits keys listing the requested scope,
 * and the oRPC/REST API (context.ts) admits keys listing `api`. A key with
 * an empty `scopes` array is an unrestricted full credential for its owner
 * scope (oRPC/REST only — MCP, versioning and admin scopes always have to
 * be listed explicitly).
 *
 * Add your own scope here (and a `apiKeys.scopes.<scope>` label in every
 * locale), then guard its surface with `requireApiKey(headers, "<scope>")`.
 */
export const API_KEY_SCOPES = ["mcp", "versioning", "api"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/**
 * Scopes only a system admin (Better Auth `user.role` "admin") may grant.
 * Creating a key with one of them is FORBIDDEN for everyone else, the
 * create dialog hides them, and such a key stops authenticating as soon as
 * its owner is no longer a non-banned system admin. Default: none.
 */
export const API_KEY_ADMIN_SCOPES: readonly ApiKeyScope[] = [];

/**
 * Scopes pre-checked in the create dialog. A key can carry any combination
 * of scopes, so users do not need one key per surface. Entries that are
 * unknown or admin-only for the viewer are dropped by the dialog.
 * (The API still accepts an empty list — existing unscoped keys keep
 * working as full credentials on oRPC/REST — but the dialog requires at
 * least one scope for new keys.)
 */
export const API_KEY_DEFAULT_SCOPES: readonly ApiKeyScope[] = ["api"];

/** Scope that admits a scoped key on the oRPC/REST API. */
export const API_SCOPE: ApiKeyScope = "api";
