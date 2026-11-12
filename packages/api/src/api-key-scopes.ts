/**
 * Registered API-key scope vocabulary — the scopes an org API key may
 * carry (`ApiKey.scopes`). A scoped key is only usable on the surfaces of
 * its scopes: `requireApiKey(headers, scope)` admits keys listing the
 * requested scope, and the oRPC/REST API (context.ts) admits keys listing
 * `api`. A key with an empty `scopes` array is an unrestricted full
 * credential for its owner scope (oRPC/REST only — MCP and versioning
 * always require their scope).
 *
 * Pure module — safe to import from client components (create-dialog
 * scope selector). The scope→feature gate map lives in `apiConfig`
 * (server-only).
 */
export const API_KEY_SCOPES = ["mcp", "versioning", "api"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

/** Scope that admits a scoped key on the oRPC/REST API. */
export const API_SCOPE: ApiKeyScope = "api";
