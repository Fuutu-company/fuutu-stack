/**
 * API configuration — owned by @fuutu/api.
 *
 * Per-endpoint rate limits applied by the oRPC rate-limit middleware.
 * Defaults are generous; specific endpoints tighten the limits.
 */
export const apiConfig = {
	rateLimit: {
		enabled: true,
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
			// Auth endpoints — very strict
			auth: {
				maxRequests: 10,
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
			// Public endpoints — generous
			public: {
				maxRequests: 100,
				windowMs: 60 * 1000,
			},
		},
	},
} as const;

export type ApiConfig = typeof apiConfig;
