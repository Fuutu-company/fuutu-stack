/**
 * Registered API-key scope vocabulary — the scopes an org API key may
 * carry (`ApiKey.scopes`). `requireApiKey(headers, scope)` only admits
 * keys that list the requested scope; a key with an empty `scopes`
 * array is an unrestricted full credential for its owner scope.
 *
 * Pure module — safe to import from client components (create-dialog
 * scope selector). The scope→feature gate map lives in `apiConfig`
 * (server-only).
 */
export const API_KEY_SCOPES = ["mcp", "versioning"] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];
