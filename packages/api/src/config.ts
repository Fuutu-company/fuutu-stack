import { env } from "@fuutu/env/saas";
import { API_KEY_ADMIN_SCOPES, API_KEY_SCOPES } from "./api-key-scopes";

/**
 * API configuration — owned by @fuutu/api.
 *
 * Per-endpoint rate limits applied by the oRPC rate-limit middleware.
 * Defaults are generous; specific endpoints tighten the limits.
 */
export const apiConfig = {
	rateLimit: {
		enabled: !env.FUUTU_DISABLE_RATE_LIMIT,
		// `TRUST_PROXY_HEADERS=1` behind a trusted reverse proxy (Traefik in
		// Coolify, nginx, a load balancer) so anonymous callers are limited
		// per IP. Without one, client-supplied X-Forwarded-For would let
		// callers rotate keys at will — so anonymous traffic shares one bucket.
		// `=== true`: an unvalidated raw string (SKIP_ENV_VALIDATION) never
		// turns trust on.
		trustProxyHeaders: env.TRUST_PROXY_HEADERS === true,
		defaults: {
			maxRequests: 100,
			windowMs: 60 * 1000, // 1 minute
		},
		endpoints: {
			// AI endpoints — stricter limits
			aiChat: {
				maxRequests: 20,
				windowMs: 60 * 1000,
			},
			// User mutations — moderate
			userUpdate: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// Notification mutations — moderate
			notificationMutation: {
				maxRequests: 60,
				windowMs: 60 * 1000,
			},
			// Organization mutations — moderate
			organizationMutation: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// Organization member mutations — moderate
			organizationMember: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// CRM contact mutations — moderate
			crmContact: {
				maxRequests: 60,
				windowMs: 60 * 1000,
			},
			// Webhook mutations — moderate
			webhookMutation: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// Storage mutations — moderate
			storageMutation: {
				maxRequests: 60,
				windowMs: 60 * 1000,
			},
			// Chat conversation mutations — moderate
			chatConversation: {
				maxRequests: 60,
				windowMs: 60 * 1000,
			},
			// API key mutations — moderate
			apiKeyMutation: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// Payments mutations — moderate
			paymentsMutation: {
				maxRequests: 30,
				windowMs: 60 * 1000,
			},
			// Search queries — moderate (DB scan cost per query)
			search: {
				maxRequests: 60,
				windowMs: 60 * 1000,
			},
		},
	},
	/**
	 * Registered API-key scope vocabulary. Org API keys may carry one or
	 * more of these scopes; `requireApiKey(headers, scope)` only admits
	 * keys that list the requested scope, and the oRPC/REST API only admits
	 * scoped keys that list `api`. A key with an empty `scopes` array is an
	 * unrestricted full credential for its owner scope on oRPC/REST.
	 *
	 * Edit the list in `./api-key-scopes.ts` — kept there so client
	 * components can import it without this file's server-only deps.
	 */
	apiKeyScopes: API_KEY_SCOPES,
	/**
	 * Scopes only system admins may grant (default none — edit in
	 * `./api-key-scopes.ts`). Others get FORBIDDEN on create; a key with
	 * one stops working once its owner is no longer a system admin.
	 */
	apiKeyAdminScopes: API_KEY_ADMIN_SCOPES,
	/**
	 * Maps an API-key scope to a FEATURE_CATALOG flat feature id
	 * (e.g. `{ versioning: "api_webhooks" }`). `requireApiKey` responds
	 * 402 upgrade_required when the org's entitlement lacks the mapped
	 * feature. Empty = no feature gates.
	 */
	apiKeyScopeFeatures: {} as Record<string, string>,
	/**
	 * MCP server at `/api/mcp` (tools in `src/mcp/`). Callers authenticate
	 * with an organization API key carrying the `mcp` scope, or — with
	 * `authConfig.mcpOAuth` enabled — an OAuth access token from Better Auth.
	 * - `auth: "optional"`: anonymous callers see only `access: "public"` tools
	 * - `auth: "required"`: anonymous callers get 401
	 *
	 * MCP clients only start the OAuth flow after a 401, so hosted clients
	 * (Claude.ai, ChatGPT) that should sign users in need `auth: "required"`;
	 * with `"optional"` they connect anonymously and see public tools only.
	 */
	mcp: {
		enabled: true,
		auth: "optional" as "optional" | "required",
		/** Always-loaded guidance for connected agents (keep < 4 KB). */
		instructions: undefined as string | undefined,
		/** Per client IP (anonymous) / per credential (API key, OAuth token). */
		rateLimit: {
			anonymous: { maxRequests: 30, windowMs: 60 * 1000 },
			authenticated: { maxRequests: 300, windowMs: 60 * 1000 },
		},
	},
} as const;

export type ApiConfig = typeof apiConfig;
