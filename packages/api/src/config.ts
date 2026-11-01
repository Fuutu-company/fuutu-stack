import { env } from "@fuutu/env/saas";
import { API_KEY_SCOPES } from "./api-key-scopes";

/**
 * API configuration — owned by @fuutu/api.
 *
 * Per-endpoint rate limits applied by the oRPC rate-limit middleware.
 * Defaults are generous; specific endpoints tighten the limits.
 */
export const apiConfig = {
	rateLimit: {
		enabled: !env.FUUTU_DISABLE_RATE_LIMIT,
		// Only set true behind a trusted proxy that overwrites
		// X-Forwarded-For / X-Real-IP — otherwise client-supplied headers
		// let anonymous callers rotate rate-limit keys at will.
		trustProxyHeaders: false,
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
	 * keys that list the requested scope. A key with an empty `scopes`
	 * array is an unrestricted full credential for its owner scope.
	 */
	apiKeyScopes: API_KEY_SCOPES,
	/**
	 * Maps an API-key scope to a FEATURE_CATALOG flat feature id
	 * (e.g. `{ versioning: "api_webhooks" }`). `requireApiKey` responds
	 * 402 upgrade_required when the org's entitlement lacks the mapped
	 * feature. Empty = no feature gates.
	 */
	apiKeyScopeFeatures: {} as Record<string, string>,
} as const;

export type ApiConfig = typeof apiConfig;
