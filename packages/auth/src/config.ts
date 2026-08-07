/**
 * Auth configuration — owned by @fuutu/auth.
 *
 * Static, build-time configuration for Better Auth:
 * session lifetime, password policy, cookies, rate limiting,
 * social providers, and post-auth redirect targets.
 *
 * Secrets and environment-dependent values live in @fuutu/env, not here.
 */

export const authConfig = {
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 5 * 60, // 5 minutes
		},
	},
	rateLimiting: {
		enabled: true,
		window: 60, // seconds
		max: 10, // max requests per window
	},
	passwordPolicy: {
		minLength: 8,
		maxLength: 128,
		requireUppercase: true,
		requireLowercase: true,
		requireNumbers: true,
		requireSpecialChars: true,
	},
	cookies: {
		sameSite: "lax" as const,
		httpOnly: true,
		// `secure` is set dynamically based on NODE_ENV in the auth server.
	},
	accountLinking: {
		enabled: true,
		trustedProviders: ["google", "github"] as const,
	},
	features: {
		emailPassword: true,
		magicLink: true,
		socialLogin: true,
		passkeys: true,
		twoFactor: true,
		changeEmail: true,
	},
	socialProviders: {
		google: {
			enabled: true,
			scopes: ["email", "profile"],
		},
		github: {
			enabled: true,
			scopes: ["user:email"],
		},
	},
	signup: {
		enabled: true,
		requireEmailVerification: false,
		allowedDomains: [] as string[], // empty = all domains allowed
		invitationOnly: false,
	},
	redirects: {
		afterSignIn: "/dashboard",
		afterSignOut: "/auth/sign-in",
		afterSignUp: "/onboarding",
		afterEmailVerification: "/dashboard",
	},
} as const;

export type AuthConfig = typeof authConfig;
