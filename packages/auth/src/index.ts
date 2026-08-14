import { passkey } from "@better-auth/passkey";
import { config } from "@fuutu/config";
import { prismaAuditSink } from "@fuutu/db";
import { db } from "@fuutu/db/internal/client";
import { env } from "@fuutu/env/saas";
import { createLogger, setAuditSink } from "@fuutu/logs";
import { createCustomerForUser } from "@fuutu/payments";
import type { BetterAuthOptions, Auth as ServerAuth } from "better-auth";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import {
	admin,
	lastLoginMethod,
	magicLink,
	multiSession,
	openAPI,
	organization,
	twoFactor,
	username,
} from "better-auth/plugins";
import { authConfig } from "./config";
import { logSessionCreated, logSignUp } from "./hooks/audit";
import { assertInvitationForSignup } from "./hooks/invitation-only";
import {
	cancelActiveSubscriptionsForOrganization,
	cancelActiveSubscriptionsForUser,
	syncSeatsForOrganization,
} from "./hooks/payments-sync";
import { sendEmail } from "./lib/email";

// Route every `createAuditLogger` call across the monorepo into the canonical
// Postgres `AuditLog` table. Safe to call multiple times — last writer wins.
setAuditSink(prismaAuditSink);

const log = createLogger({ scope: "auth" });

const authOptions = {
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	trustedOrigins: [env.CORS_ORIGIN],

	// Rate limiting: Prevent brute-force attacks and email spam.
	// Disabled in development and when FUUTU_DISABLE_RATE_LIMIT is set (CI E2E).
	rateLimit: {
		enabled:
			authConfig.rateLimiting.enabled &&
			env.NODE_ENV === "production" &&
			!env.FUUTU_DISABLE_RATE_LIMIT,
		window: authConfig.rateLimiting.window,
		max: authConfig.rateLimiting.max,
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
			username: {
				type: "string",
				required: false,
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
				user: { email: string; name: string; locale?: "en" | "de" };
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
					log.warn("change email confirmation failed", { err: String(err) });
				}
			},
		},
	},

	emailAndPassword: {
		enabled: authConfig.features.emailPassword,
		autoSignIn: !authConfig.signup.requireEmailVerification,
		requireEmailVerification: authConfig.signup.requireEmailVerification,
		minPasswordLength: authConfig.passwordPolicy.minLength,
		maxPasswordLength: authConfig.passwordPolicy.maxLength,
		sendResetPassword: async ({
			user,
			url,
		}: {
			user: { email: string; name: string; locale?: "en" | "de" };
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
				log.warn("reset password email failed", { err: String(err) });
			}
		},
	},

	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			try {
				await sendEmail({
					to: user.email,
					template: "email-verification",
					data: {
						name: user.name,
						verificationUrl: url,
						locale: (user as { locale?: "en" | "de" }).locale,
					},
				});
			} catch (err) {
				log.warn("verification email failed", { err: String(err) });
			}
		},
	},

	// Only register providers whose credentials are actually present.
	// Better-Auth otherwise logs a WARN on every boot in dev environments
	// where we intentionally skip OAuth wiring.
	socialProviders: {
		...(authConfig.socialProviders.google.enabled &&
		env.GOOGLE_CLIENT_ID &&
		env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET,
						scope: [...authConfig.socialProviders.google.scopes],
					},
				}
			: {}),
		...(authConfig.socialProviders.github.enabled &&
		env.GITHUB_CLIENT_ID &&
		env.GITHUB_CLIENT_SECRET
			? {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET,
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
		defaultCookieAttributes: {
			sameSite: authConfig.cookies.sameSite,
			secure: env.NODE_ENV === "production",
			httpOnly: authConfig.cookies.httpOnly,
		},
	},

	// Audit + lifecycle hooks.
	// Banned-user check lives in `requireAuth()` (apps/saas/src/lib/auth-server.ts)
	// because Better-Auth redirects are framework-specific.
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					// Invitation-only sign-up gate.
					await assertInvitationForSignup({ email: user.email });
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
								appUrl: env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:3000",
								locale: (user as { locale?: "en" | "de" }).locale,
							},
						});
					} catch (err) {
						log.warn("welcome email failed", { err: String(err) });
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
				after: async (session) => {
					await logSessionCreated({
						userId: session.userId,
						ipAddress: session.ipAddress,
						userAgent: session.userAgent,
					});
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
		openAPI(),

		// Passkeys (WebAuthn). Since better-auth 1.5 this lives in
		// its own dedicated package (`@better-auth/passkey`).
		...(authConfig.features.passkeys
			? [
					passkey({
						rpName: config.app.name,
						rpID: new URL(env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:3000")
							.hostname,
					}),
				]
			: []),

		...(config.features.organizationsMode !== "off"
			? [
					organization({
						async sendInvitationEmail({ email, id, organization }) {
							const inviteUrl = `${env.NEXT_PUBLIC_SAAS_URL ?? "http://localhost:3000"}/auth/accept-invitation?id=${id}`;
							await sendEmail({
								to: email,
								template: "organization-invitation",
								data: {
									organizationName: organization.name,
									inviteUrl,
								},
							});
						},
						// Sync seats with the payment provider on membership changes.
						organizationHooks: {
							afterAcceptInvitation: async ({ invitation }) => {
								await syncSeatsForOrganization(invitation.organizationId);
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
			defaultBanReason: "Violation of terms of service",
			bannedUserMessage:
				"Your account has been suspended. Please contact support if you believe this is an error.",
		}),

		multiSession(),

		// Track the last authentication method (email, google, github, passkey,
		// magic-link) in a cookie so the sign-in page can highlight the method
		// the user used last time — prevents accidental duplicate accounts.
		lastLoginMethod(),

		...(authConfig.features.magicLink
			? [
					magicLink({
						sendMagicLink: async ({ email, url }) => {
							await sendEmail({
								to: email,
								subject: "Sign in to your account",
								template: "magic-link",
								data: {
									magicLinkUrl: url,
								},
							});
						},
					}),
				]
			: []),
	],
} satisfies BetterAuthOptions;

export const auth: ServerAuth<typeof authOptions> = betterAuth(authOptions);

export type Auth = typeof auth;
