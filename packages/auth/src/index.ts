import { mcp } from "@better-auth/mcp";
import { DEFAULT_OAUTH_SCOPES } from "@better-auth/oauth-provider";
import { passkey } from "@better-auth/passkey";
import { config } from "@fuutu/config";
import {
	getUserByEmail,
	prismaAuditSink,
	revokeOAuthTokensForUser,
} from "@fuutu/db";
import { db } from "@fuutu/db/internal/client";
import { env } from "@fuutu/env/saas";
import { createLogger, logsConfig, setAuditSink } from "@fuutu/logs";
import { createCustomerForUser } from "@fuutu/payments";
import type { BetterAuthOptions, Auth as ServerAuth } from "better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import {
	admin,
	jwt,
	lastLoginMethod,
	magicLink,
	multiSession,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { authConfig } from "./config";
import {
	persistActiveOrganizationChange,
	restoreActiveOrganization,
} from "./hooks/active-organization";
import { logSessionCreated, logSignUp } from "./hooks/audit";
import { assertInvitationForSignup } from "./hooks/invitation-only";
import {
	assertRegistrationWithinLimits,
	getAuthorizeParams,
	getPromptNoneBlockUrl,
	getUnverifiedErrorRedirect,
} from "./hooks/mcp-oauth-guards";
import {
	revokeOAuthTokensAfterAccountChange,
	revokeOAuthTokensBeforeConsentDelete,
} from "./hooks/mcp-oauth-revocation";
import { assertPasswordPolicy } from "./hooks/password-policy";
import {
	cancelActiveSubscriptionsForOrganization,
	cancelActiveSubscriptionsForUser,
	syncSeatsForOrganization,
} from "./hooks/payments-sync";
import {
	assertInviteSeatAvailable,
	assertSeatAvailable,
} from "./hooks/seat-limit";
import { assertSignupPolicy } from "./hooks/signup-policy";
import { emitUserCreatedOnFirstMembership } from "./hooks/user-created";
import { sendEmail } from "./lib/email";
import { MCP_ORG_CLAIM, mcpOAuth } from "./mcp-oauth";
import { getSocialCredentials, isSocialProviderActive } from "./methods";
import { mcpConnectedApps } from "./plugins/mcp-connected-apps";

// Route every `createAuditLogger` call across the monorepo into the canonical
// Postgres `AuditLog` table — but only when LOG_AUDIT_SINK=db (the default is
// "console"). Registration lives here because @fuutu/auth owns the @fuutu/db
// dependency edge; @fuutu/logs stays dependency-free so it can never import
// the Prisma sink itself (@fuutu/db pulls `pg`, Node-only, and would leak
// into client bundles). This runs at import time — server contexts that
// never import @fuutu/auth keep the console sink, which is intentional.
if (logsConfig.auditSink === "db") {
	setAuditSink(prismaAuditSink);
}

const log = createLogger({ scope: "auth" });

if (env.FUUTU_DISABLE_RATE_LIMIT) {
	log.warn(
		"FUUTU_DISABLE_RATE_LIMIT is set — auth rate limiting is DISABLED. Intended for CI/E2E only; never set this in production.",
	);
}

// Base URL of the public SaaS app — used for links in auth emails and
// the passkey relying-party ID.
const saasBaseUrl = env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:3000";

if (!env.NEXT_PUBLIC_SAAS_URL && env.NODE_ENV === "production") {
	log.warn(
		"NEXT_PUBLIC_SAAS_URL is unset — auth emails and passkeys will point at http://localhost:3000.",
	);
}

const socialCredentials = getSocialCredentials();

/** Lifetime of MCP OAuth access tokens (JWT, not revocable). */
const MCP_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Error page for OAuth errors that must not go back to the client. */
const getErrorPageUrl = (context: {
	baseURL: string;
	options: { onAPIError?: { errorURL?: string } };
}) => context.options.onAPIError?.errorURL || `${context.baseURL}/error`;

const authOptions = {
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.CORS_ORIGIN],

	// Without this, production builds redirect auth errors to `/?error=…`
	// and the app root forwards signed-in users to the dashboard — the
	// error vanishes. The app page shows it (MCP OAuth guards use it too).
	onAPIError: {
		errorURL: `${saasBaseUrl}${authConfig.redirects.error}`,
	},

	// The JWT plugin's session-to-JWT route would mint tokens signed with
	// the same key as MCP access tokens — disabled per the oauth-provider docs.
	...(mcpOAuth.active ? { disabledPaths: ["/token"] } : {}),

	// Rate limiting: Prevent brute-force attacks and email spam.
	// Disabled when FUUTU_DISABLE_RATE_LIMIT is set (CI E2E).
	// Stored in Postgres (`rate_limit` table) so limits hold across
	// serverless instances and multiple replicas.
	rateLimit: {
		enabled: authConfig.rateLimiting.enabled && !env.FUUTU_DISABLE_RATE_LIMIT,
		window: authConfig.rateLimiting.window,
		max: authConfig.rateLimiting.max,
		storage: "database",
	},

	session: {
		expiresIn: authConfig.session.expiresIn,
		updateAge: authConfig.session.updateAge,
		cookieCache: {
			enabled: authConfig.session.cookieCache.enabled,
			maxAge: authConfig.session.cookieCache.maxAge,
		},
	},

	user: {
		additionalFields: {
			// Custom field for user's preferred locale (i18n)
			locale: {
				type: "string",
				required: false,
			},
			onboardingComplete: {
				type: "boolean",
				required: false,
				defaultValue: false,
				input: false,
			},
			paymentsCustomerId: {
				type: "string",
				required: false,
				input: false,
			},
			lastActiveOrganizationId: {
				type: "string",
				required: false,
				input: false,
			},
		},
		changeEmail: {
			enabled: authConfig.features.changeEmail,
			sendChangeEmailConfirmation: async ({
				user,
				newEmail,
				url,
			}: {
				user: { email: string; name: string; locale?: string };
				newEmail: string;
				url: string;
			}) => {
				try {
					await sendEmail({
						to: newEmail,
						template: "email-change-verification",
						data: {
							name: user.name,
							verificationUrl: url,
							newEmail,
							locale: user.locale,
						},
					});
				} catch (err) {
					log.error("change email confirmation failed", { err: String(err) });
				}
			},
		},
	},

	// Server-side enforcement of authConfig.passwordPolicy complexity rules
	// (Better-Auth itself only checks min/max length). Runs for every
	// endpoint that carries a plaintext password.
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			assertPasswordPolicy(ctx.path, ctx.body);
			if (!mcpOAuth.active) return;

			// MCP OAuth guards — see hooks/mcp-oauth-guards.ts.
			if (ctx.path === "/oauth2/register") {
				assertRegistrationWithinLimits(
					ctx.body,
					ctx.request?.headers.get("content-length"),
				);
			}
			if (ctx.path === "/oauth2/authorize") {
				const url = await getPromptNoneBlockUrl(
					getAuthorizeParams(ctx.query, ctx.body),
					getErrorPageUrl(ctx.context),
				);
				if (url) {
					const fromFetch =
						ctx.request?.headers.get("sec-fetch-mode") === "cors" ||
						ctx.headers?.get("accept")?.includes("application/json");
					if (fromFetch) return ctx.json({ redirect: true, url });
					throw ctx.redirect(url);
				}
			}
			if (ctx.path === "/oauth2/delete-consent") {
				const session = await getSessionFromCtx(ctx);
				await revokeOAuthTokensBeforeConsentDelete({
					path: ctx.path,
					body: ctx.body,
					userId: session?.user.id,
				});
			}
		}),
		after: createAuthMiddleware(async (ctx) => {
			if (!mcpOAuth.active) return;
			if (ctx.path === "/oauth2/authorize") {
				const replacement = await getUnverifiedErrorRedirect({
					returned: ctx.context.returned,
					params: getAuthorizeParams(ctx.query, ctx.body),
					appOrigin: new URL(ctx.context.baseURL).origin,
					errorPageUrl: getErrorPageUrl(ctx.context),
				});
				if (replacement?.mode === "json") {
					return ctx.json({ redirect: true, url: replacement.url });
				}
				if (replacement) throw ctx.redirect(replacement.url);
				return;
			}
			await revokeOAuthTokensAfterAccountChange({
				path: ctx.path,
				returned: ctx.context.returned,
				userId: ctx.context.session?.user.id,
			});
		}),
	},

	emailAndPassword: {
		enabled: authConfig.features.emailPassword,
		disableSignUp: !authConfig.signup.enabled,
		autoSignIn: !authConfig.signup.requireEmailVerification,
		requireEmailVerification: authConfig.signup.requireEmailVerification,
		minPasswordLength: authConfig.passwordPolicy.minLength,
		maxPasswordLength: authConfig.passwordPolicy.maxLength,
		// MCP refresh tokens outlive sessions — a reset (account recovery)
		// must cut off connected OAuth clients too.
		onPasswordReset: async ({ user }) => {
			if (mcpOAuth.active) await revokeOAuthTokensForUser(user.id);
		},
		sendResetPassword: async ({
			user,
			url,
		}: {
			user: { email: string; name: string; locale?: string };
			url: string;
		}) => {
			try {
				await sendEmail({
					to: user.email,
					template: "password-reset",
					data: {
						name: user.name,
						resetUrl: url,
						locale: user.locale,
					},
				});
			} catch (err) {
				log.error("reset password email failed", { err: String(err) });
			}
		},
	},

	emailVerification: {
		// Without this, enabling `requireEmailVerification` locks users out:
		// no verification mail would ever fire on sign-up.
		sendOnSignUp: authConfig.signup.requireEmailVerification,
		sendVerificationEmail: async ({ user, url }) => {
			try {
				await sendEmail({
					to: user.email,
					template: "email-verification",
					data: {
						name: user.name,
						verificationUrl: url,
						locale: (user as { locale?: string }).locale,
					},
				});
			} catch (err) {
				log.error("verification email failed", { err: String(err) });
			}
		},
	},

	// Only register providers whose credentials are actually present.
	// Better-Auth otherwise logs a WARN on every boot in dev environments
	// where we intentionally skip OAuth wiring.
	// Same predicate the sign-in UI uses (`getAuthMethods`), so a provider
	// button is shown exactly when the provider is registered here.
	socialProviders: {
		...(isSocialProviderActive("google", socialCredentials.google)
			? {
					google: {
						clientId: socialCredentials.google.clientId,
						clientSecret: socialCredentials.google.clientSecret,
						scope: [...authConfig.socialProviders.google.scopes],
					},
				}
			: {}),
		...(isSocialProviderActive("github", socialCredentials.github)
			? {
					github: {
						clientId: socialCredentials.github.clientId,
						clientSecret: socialCredentials.github.clientSecret,
						scope: [...authConfig.socialProviders.github.scopes],
					},
				}
			: {}),
	},

	account: {
		accountLinking: {
			enabled: authConfig.accountLinking.enabled,
			trustedProviders: [...authConfig.accountLinking.trustedProviders],
		},
	},

	advanced: {
		// Rate limits (incl. open MCP client registration) key on the client
		// IP from `advanced.ipAddress.ipAddressHeaders` (default:
		// x-forwarded-for). Behind a reverse proxy / load balancer, set it to
		// the header your trusted proxy writes (e.g. ["cf-connecting-ip"]), or
		// list the proxies in `trustedProxies` — otherwise clients can spoof
		// their IP and dodge the limits. Default intentionally unchanged.
		defaultCookieAttributes: {
			sameSite: authConfig.cookies.sameSite,
			// `secure` is intentionally NOT overridden — Better Auth derives it
			// (and the `__Secure-` prefix) from the BETTER_AUTH_URL protocol.
			// Forcing it on via NODE_ENV broke E2E on WebKit: http://localhost in
			// CI + Secure cookies = session cookie dropped (WebKit only treats
			// loopback as secure on Cocoa builds, not the Linux port).
			httpOnly: authConfig.cookies.httpOnly,
		},
	},

	// Audit + lifecycle hooks.
	// Banned-user check lives in `requireAuth()` (apps/saas/src/lib/auth-server.ts)
	// because Better-Auth redirects are framework-specific.
	databaseHooks: {
		user: {
			create: {
				before: async (user, ctx) => {
					// authConfig.signup gate (enabled / allowedDomains) on
					// self-service paths, then the invitation-only gate.
					assertSignupPolicy({ email: user.email }, ctx);
					await assertInvitationForSignup({ email: user.email }, ctx);
				},
				after: async (user) => {
					await logSignUp({ id: user.id });
					// Create a customer record at the active payment provider.
					// Best-effort: a provider failure must never abort sign-up.
					try {
						await createCustomerForUser({
							id: user.id,
							email: user.email,
							name: user.name,
						});
					} catch (err) {
						log.warn("create customer on signup failed", { err: String(err) });
					}
					// Welcome email (uses the `new-user` template).
					// Best-effort: a delivery failure must never abort sign-up.
					try {
						await sendEmail({
							to: user.email,
							template: "new-user",
							data: {
								name: user.name,
								appUrl: saasBaseUrl,
								locale: (user as { locale?: string }).locale,
							},
						});
					} catch (err) {
						log.error("welcome email failed", { err: String(err) });
					}
				},
			},
			delete: {
				before: async (user) => {
					// Cancel active subscriptions before the user row is deleted.
					await cancelActiveSubscriptionsForUser(user.id);
				},
			},
		},
		session: {
			create: {
				// Start a new session in the org the user last worked in
				// (`user.lastActiveOrganizationId`), if still a member.
				before: async (session) => {
					if (config.features.organizationsMode === "off") return;
					const activeOrganizationId = await restoreActiveOrganization(session);
					if (activeOrganizationId) {
						return { data: { ...session, activeOrganizationId } };
					}
				},
				after: async (session) => {
					// Audit must never break sign-in.
					try {
						await logSessionCreated({
							userId: session.userId,
							activeOrganizationId:
								typeof session.activeOrganizationId === "string"
									? session.activeOrganizationId
									: null,
							ipAddress: session.ipAddress,
							userAgent: session.userAgent,
						});
					} catch (err) {
						log.warn("session audit log failed", { err: String(err) });
					}
				},
			},
			// The org plugin switches orgs by writing `activeOrganizationId`
			// to the current session — mirror it so the next sign-in restores it.
			update: {
				before: async (update, ctx) => {
					await persistActiveOrganizationChange(
						update,
						ctx?.context.session?.user.id,
					);
				},
			},
		},
	},

	plugins: [
		// TOTP-based 2FA.
		...(authConfig.features.twoFactor
			? [
					twoFactor({
						issuer: config.app.name,
					}),
				]
			: []),

		// Username login (enables `username` field + sign-in by username).
		username(),

		// OpenAPI doc endpoint at `/api/auth/reference` (+ `/api/auth/open-api/generate-schema`).
		// Dev/staging only — not exposed in production.
		...(env.NODE_ENV !== "production" ? [openAPI()] : []),

		// Passkeys (WebAuthn). Since better-auth 1.5 this lives in
		// its own dedicated package (`@better-auth/passkey`).
		...(authConfig.features.passkeys
			? [
					passkey({
						rpName: config.app.name,
						rpID: new URL(saasBaseUrl).hostname,
					}),
				]
			: []),

		...(config.features.organizationsMode !== "off"
			? [
					organization({
						allowUserToCreateOrganization:
							authConfig.organizations.allowUserToCreateOrganization === "admin"
								? (user) => (user as { role?: string }).role === "admin"
								: authConfig.organizations.allowUserToCreateOrganization ===
									"all",
						async sendInvitationEmail({ email, id, organization, inviter }) {
							const inviteUrl = `${saasBaseUrl}/auth/accept-invitation?id=${id}`;
							try {
								await sendEmail({
									to: email,
									template: "organization-invitation",
									data: {
										organizationName: organization.name,
										inviteUrl,
										inviterName: inviter.user.name,
										locale: (inviter.user as { locale?: string }).locale,
									},
								});
							} catch (err) {
								log.error("invitation email failed", { err: String(err) });
							}
						},
						// Sync seats with the payment provider on membership changes;
						// before* hooks enforce the plan's membersPerOrg seat cap.
						organizationHooks: {
							beforeAddMember: async ({ member }) => {
								await assertSeatAvailable(member.organizationId);
							},
							beforeCreateInvitation: async ({ invitation }) => {
								await assertInviteSeatAvailable(invitation.organizationId);
							},
							beforeAcceptInvitation: async ({ invitation }) => {
								await assertSeatAvailable(invitation.organizationId);
							},
							afterAddMember: async ({ member }) => {
								await syncSeatsForOrganization(member.organizationId);
								await emitUserCreatedOnFirstMembership(
									member.userId,
									member.organizationId,
								);
							},
							afterAcceptInvitation: async ({ invitation, member }) => {
								await syncSeatsForOrganization(invitation.organizationId);
								await emitUserCreatedOnFirstMembership(
									member.userId,
									invitation.organizationId,
								);
							},
							afterRemoveMember: async ({ member }) => {
								await syncSeatsForOrganization(member.organizationId);
							},
							beforeDeleteOrganization: async ({ organization }) => {
								await cancelActiveSubscriptionsForOrganization(organization.id);
							},
						},
					}),
				]
			: []),

		admin({
			defaultBanReason: authConfig.admin.defaultBanReason,
			bannedUserMessage: authConfig.admin.bannedUserMessage,
		}),

		multiSession(),

		// Track the last authentication method (email, google, github, passkey,
		// magic-link) in a cookie so the sign-in page can highlight the method
		// the user used last time — prevents accidental duplicate accounts.
		lastLoginMethod(),

		// OAuth 2.1 authorization server for MCP clients (`/api/mcp`).
		// Discovery documents are served from the app root by
		// apps/saas/src/app/.well-known/*; tokens are verified in
		// @fuutu/api (resolveMcpPrincipal → verifyMcpAccessToken).
		...(mcpOAuth.active
			? [
					jwt({
						disableSettingJwtHeader: true,
						jwt: { issuer: mcpOAuth.issuer },
					}),
					mcp({
						loginPage: "/auth/sign-in",
						consentPage: "/auth/consent",
						resource: mcpOAuth.resource,
						// Seeded resource row with explicit `allowedScopes` (= every
						// provider scope, i.e. unrestricted): the default seed writes
						// `null`, which Prisma rejects for list columns.
						resources: [
							{
								identifier: mcpOAuth.resource,
								name: `${config.app.name} MCP`,
								allowedScopes: [...DEFAULT_OAUTH_SCOPES],
							},
						],
						// Open RFC 7591 registration for public clients (Claude Code,
						// Cursor, VS Code register themselves on first connect).
						allowDynamicClientRegistration: true,
						allowUnauthenticatedClientRegistration: true,
						clientRegistrationDefaultApplicationType: "infer",
						// Consent is stored per active organization; the org id
						// rides along as `referenceId` into the access token.
						// `shouldRedirect` never redirects — no extra selection step.
						postLogin: {
							page: "/auth/consent",
							shouldRedirect: () => false,
							consentReferenceId: ({ session }) =>
								typeof session.activeOrganizationId === "string"
									? session.activeOrganizationId
									: undefined,
						},
						customAccessTokenClaims: ({ referenceId }) =>
							referenceId ? { [MCP_ORG_CLAIM]: referenceId } : {},
						// Access tokens are stateless JWTs — revoking a connected app
						// or a password change only stops refreshes, so keep them
						// short-lived (default 1 h).
						accessTokenExpiresIn: MCP_ACCESS_TOKEN_TTL_SECONDS,
					}),
					// Settings → "Connected apps": list + revoke OAuth grants.
					mcpConnectedApps(),
				]
			: []),

		...(authConfig.features.magicLink
			? [
					magicLink({
						disableSignUp: !authConfig.signup.enabled,
						sendMagicLink: async ({ email, url }) => {
							try {
								const recipient = await getUserByEmail(email);
								await sendEmail({
									to: email,
									template: "magic-link",
									data: {
										magicLinkUrl: url,
										locale: (recipient as { locale?: string } | null)?.locale,
									},
								});
							} catch (err) {
								log.error("magic link email failed", { err: String(err) });
							}
						},
					}),
				]
			: []),
	],
} satisfies BetterAuthOptions;

export const auth: ServerAuth<typeof authOptions> = betterAuth(authOptions);

export type Auth = typeof auth;
