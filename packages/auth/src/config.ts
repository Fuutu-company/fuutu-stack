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
	/**
	 * Session lifetime, in seconds — document it in your privacy policy.
	 * `expiresIn`: a session — and the `better-auth.session_token` cookie's
	 * max-age — ends 30 days after it was last extended; `updateAge`: use
	 * extends it, at most once a day. `cookieCache.maxAge`: the signed
	 * `better-auth.session_data` cookie caches the session for 1 minute —
	 * a revoked session or a ban takes effect within that window.
	 * `freshSessionMaxAge`: an email change needs a sign-in at most this
	 * long ago (hooks/fresh-session.ts).
	 */
	session: {
		expiresIn: 60 * 60 * 24 * 30, // 30 days
		updateAge: 60 * 60 * 24, // 1 day
		cookieCache: {
			enabled: true,
			maxAge: 60, // 1 minute
		},
		freshSessionMaxAge: 15 * 60, // 15 minutes
	},
	rateLimiting: {
		enabled: true,
		window: 60, // seconds
		// Global per-path budget. Credential endpoints (/sign-in/*, /sign-up/*,
		// /change-password, /change-email, reset/verify paths) are covered by
		// Better-Auth's built-in special rules (max 3/10s) — this limit only
		// governs the rest. GET /get-session and /organization/list are
		// exempt, GET /organization/get-full-organization is 30/2s
		// (rate-limit-rules.ts).
		// These built-in rules are version-pinned behavior — re-verify after
		// any better-auth bump (if defaults are removed, brute-force
		// protection silently weakens).
		max: 100,
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
		// `secure` is NOT set here — Better Auth derives it (and the
		// `__Secure-` cookie prefix) from the BETTER_AUTH_URL protocol.
	},
	accountLinking: {
		enabled: true,
		// Providers whose sign-in links into an existing account even when
		// the provider reports the email as unverified. Empty: only a
		// verified provider email links (Google and GitHub report it).
		trustedProviders: [] as ("google" | "github")[],
	},
	// Admin-plugin messages — customization point for kit buyers.
	admin: {
		defaultBanReason: "Violation of terms of service",
		bannedUserMessage:
			"Your account has been suspended. Please contact support if you believe this is an error.",
		// How long a support impersonation session lasts, counted from its
		// start (`isImpersonationExpired`) — refreshes never extend it.
		impersonationMinutes: 60,
		// `true` serves Better Auth's own `/api/auth/admin/*` endpoints
		// (`authClient.admin.*`) again — they bypass the audited `admin.*`
		// oRPC procedures (reason, audit row, peer and impersonation guards).
		exposeAuthEndpoints: false as boolean,
	},
	features: {
		emailPassword: true,
		magicLink: true,
		socialLogin: true,
		passkeys: true,
		twoFactor: true,
		changeEmail: true,
		// Self-service account deletion (Settings → Danger zone). Sole
		// owners of an organization are refused; subscriptions are
		// cancelled first and a failed cancel aborts the delete.
		deleteAccount: true,
		// Better Auth plugins the kit ships no UI for — off, so their
		// endpoints are not served. `username`: sign-in by username;
		// `multiSession`: several accounts in one browser.
		username: false,
		multiSession: false,
	},
	socialProviders: {
		google: {
			enabled: true,
			scopes: ["openid", "email", "profile"],
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
	organizations: {
		// Who may create organizations:
		//  "all"   — any signed-in user (self-serve SaaS)
		//  "admin" — only system admins (user.role "admin"); sales-led /
		//            white-glove flows where staff provision orgs and invite
		//            owners. Non-admins see invite/contact states instead of
		//            the create form.
		//  "none"  — org creation fully disabled; users join via invitation
		//            only (orgs provisioned externally, e.g. seed/admin API).
		allowUserToCreateOrganization: "all" as "all" | "admin" | "none",
		// Most organizations a user may belong to and still create another
		// (Better Auth `organizationLimit`; created and joined orgs both
		// count, invitations stay open). Unset = no cap. Applies to every
		// plan, on top of the per-plan `LIMITS.organizations`
		// (@fuutu/payments/config); system admins are capped too.
		organizationLimit: undefined as number | undefined,
		// Seconds an invitation stays valid (Better Auth `invitationExpiresIn`,
		// default 48 h); a resend — also from the admin area — restarts it.
		invitationExpiresIn: 48 * 60 * 60,
		// `true` serves Better Auth's organization mutations
		// (`/api/auth/organization/create`, `update`, `delete`,
		// `invite-member`, `update-member-role`, `remove-member`,
		// `cancel-invitation`) over HTTP again — they bypass the oRPC
		// procedures' slug rules, plan limits, rate limits, webhooks and
		// role checks. Accept/reject, list, set-active and leave stay open.
		exposeAuthEndpoints: false as boolean,
	},
	// OAuth 2.1 sign-in for MCP clients (Claude.ai, ChatGPT, Claude Code,
	// Cursor, VS Code) — Better Auth acts as the authorization server for
	// `/api/mcp`. `false` registers no OAuth plugins (API keys only).
	mcpOAuth: {
		enabled: true,
	},
	redirects: {
		afterSignIn: "/dashboard",
		afterSignOut: "/auth/sign-in",
		afterSignUp: "/onboarding",
		afterEmailVerification: "/dashboard",
		/** Auth and OAuth errors (Better Auth `onAPIError.errorURL`). */
		error: "/auth/error",
	},
} as const;

export type AuthConfig = typeof authConfig;
