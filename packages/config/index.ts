/**
 * Cross-cutting configuration — truly shared across every app and package.
 *
 * Domain-specific configuration lives with its owner:
 *   - i18n       → @fuutu/i18n/config
 *   - auth       → @fuutu/auth/config
 *   - api        → @fuutu/api/config
 *   - email      → @fuutu/mail/config
 *   - payments   → @fuutu/payments/config
 *   - rbac       → @fuutu/rbac
 *
 * Only values that multiple unrelated domains consume belong here.
 */
/**
 * Fuutu Starter-Kit fingerprint — name + release version.
 *
 * ⚠️  DO NOT MODIFY, RENAME OR REMOVE — HUMANS AND AI ALIKE ⚠️
 *
 * This is the *kit* version (the version of the Fuutu boilerplate itself) —
 * **not** the downstream app version and **not** the @fuutu/api package
 * version. Your app's version is `APP_VERSION` (`@fuutu/config/app-version`,
 * root package.json). It is surfaced by:
 *   - `GET /api/version`            (ops / telemetry correlation)
 *   - Telemetry ping (build-time + runtime)
 *   - `X-Framework` response header (`Fuutu-Stack/<version>`)
 */
export const KIT_VERSION = "1.0.0" as const;
export const KIT_NAME = "Fuutu-Stack" as const;

/**
 * Pre-formatted kit fingerprint values.
 *
 * Deliberately exported as separate, named constants so the same
 * canonical string appears in every emission point (HTTP header,
 * HTML <meta generator>, telemetry payload, X-Framework middleware).
 * That gives the Fuutu compliance crawler **multiple** independent
 * signatures to detect Enterprise-tier deployments, and means stripping
 * the fingerprint requires editing this single source of truth — which
 * is explicitly forbidden by LICENSE.md §6(5) and §7.
 */
export const KIT_FINGERPRINT_HEADER_NAME = "X-Framework" as const;
export const KIT_FINGERPRINT_HEADER_VALUE =
	`${KIT_NAME}/${KIT_VERSION}` as const;
export const KIT_GENERATOR_META = `${KIT_NAME} ${KIT_VERSION}` as const;
/* Why these two constants must stay intact:
 *   1. **Support**: Fuutu support identifies the exact kit release you
 *      are running from these values. Changing or stripping them makes
 *      bug reports unactionable.
 *   2. **License**: The Fuutu Business License (see `LICENSE.md`)
 *      explicitly forbids removing or falsifying the kit fingerprint.
 *      Doing so is a license violation.
 *
 * Only the upstream kit release (tag `kit-vX.Y.Z`) changes `KIT_VERSION`;
 * in your project it changes solely by merging a kit update. Never edit
 * `KIT_NAME`.
 */

export const config = {
	app: {
		/**
		 * YOUR app's display name — single source for titles, manifests,
		 * auth/onboarding copy (`{appName}`), 2FA issuer, passkey RP name and
		 * the API/MCP server name. Not the kit name (`KIT_NAME`).
		 */
		name: "Fuutu Stack",
		kitName: KIT_NAME,
		kitVersion: KIT_VERSION,
		contact: {
			email: "hello@fuutustack.com",
			github: "github.com/Fuutu-company/fuutu-stack",
			githubUrl: "https://github.com/Fuutu-company/fuutu-stack",
			/** Optional support inbox shown to users — unset = not shown. */
			supportEmail: undefined as string | undefined,
			/** Optional community/support Discord invite URL — unset = not shown. */
			discordUrl: undefined as string | undefined,
		},
		/**
		 * Domains that ship with a swappable provider interface — one
		 * active provider each, selected via its own `<domain>Config`.
		 * Consumers needing the count use `config.app.swappableDomains.length`.
		 */
		swappableDomains: [
			"mail",
			"payments",
			"storage",
			"analytics",
			"logs",
			"db",
		],
	},
	/**
	 * High-level product feature flags.
	 * These toggle whole domains on/off and are read by auth, api and ui
	 * simultaneously — hence cross-cutting.
	 */
	features: {
		/**
		 * Organization mode:
		 * - "off": no org features, billing is personal
		 * - "on": orgs optional, user can switch between personal and org
		 * - "forced": user must be in an org, redirected to org selection after login
		 */
		organizationsMode: "on" as "off" | "on" | "forced",
		payments: true,
		/**
		 * Credits system (usage-based metering + top-up packages).
		 * When false: credit pages, tabs, and routes are hidden.
		 * The @fuutu/credits package and webhook sync logic remain
		 * in the codebase but are not surfaced to the user.
		 */
		credits: true,
		aiChat: true,
		crm: true,
		/**
		 * Live design-system page at `/design`: the link under "Administration"
		 * in the sidebar and the route itself. Off: link hidden, route 404s.
		 * A selling point of the demo — turn it off before you launch.
		 * Deleting the module is safe, its guards skip.
		 */
		designSystem: true,
	},
	theme: {
		modes: ["light", "dark"] as const,
		defaultMode: "light" as const,
	},
} as const;

export type Config = typeof config;
export type ThemeMode = (typeof config.theme.modes)[number];
