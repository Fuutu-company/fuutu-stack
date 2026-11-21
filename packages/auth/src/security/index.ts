/**
 * Auth security policies: the one place `index.ts` wires them into Better
 * Auth. Each policy is a unit-tested module in `../hooks/`; this file only
 * sets the order. Tunables stay on `authConfig` (named per policy below).
 *
 * `hooks.before`, in this order:
 * - password-policy: complexity rules on every plaintext-password path (sign-up, change, reset, set, admin create/set).
 * - impersonation-guard: an impersonation session cannot change email, password, 2FA, passkeys, links, OAuth, orgs, profile or sessions.
 * - profile-input: caps names and keeps avatar/logo URLs on the owner's own `/image-proxy` uploads (sign-up, profile, org endpoints).
 * - fresh-session: `/change-email` and new passkeys need a sign-in within `authConfig.session.freshSessionMaxAge`.
 * - verified-email-change: `/change-email` needs a verified current address.
 * - verified-email-credentials: passkeys, `/two-factor/enable` and OAuth consent/continue need a verified email.
 * - email-verification-session: a sign-up `/verify-email` link counts only in the same user's session (off with `authConfig.signup.requireEmailVerification`).
 * - delete-user-reauth: `/delete-user` needs the password, or a fresh session without one.
 * - impersonation-session: ends an impersonation past `authConfig.admin.impersonationMinutes` or after the admin lost access.
 * - mcp-oauth-guards (MCP OAuth on): `/oauth2/register` size caps; `/oauth2/authorize` never redirects to an unverified client without interaction.
 * - mcp-oauth-revocation (MCP OAuth on): `/oauth2/delete-consent` revokes the consent's tokens.
 * - desktop-oauth: `/oauth2/authorize` and `/oauth2/token` register the desktop client first (desktop on), refuse it while off and require `offline_access`.
 *
 * `hooks.after`, in this order:
 * - organization-invitations: `/organization/get-full-organization` lists invitations only to members who may invite.
 * - email-change-notice: tells the previous address once an email change is verified.
 * - impersonation-session: an ended impersonation's `/get-session` answers signed out.
 * - member-api-keys: `/organization/leave` revokes the user's org API keys.
 * - desktop-oauth (desktop on): `/oauth2/token` clears the desktop client's consents after a sign-in, so the next one asks again.
 * - mcp-oauth-guards (MCP OAuth on): authorize errors land on the app's error page.
 * - mcp-oauth-revocation (MCP OAuth on): password change and session revocation end OAuth tokens.
 *
 * `databaseHooks`:
 * - signup-policy + invitation-only (`user.create.before`): `authConfig.signup` gates (enabled, allowedDomains, invitationOnly) on self-service paths.
 * - account-deletion (`user.delete.before`): refuses sole owners, cancels subscriptions first (a failed cancel aborts).
 * - unproven-credentials (`user.update`): a magic-link / email-OTP mailbox proof removes the squatter's passkeys, 2FA, API keys and OAuth tokens.
 * - second-factor-session (`account.create.before`, `session.create.before`): magic link, OTP and social sign-ins never skip 2FA.
 *
 * `organizationHooks`:
 * - last-owner (`beforeRemoveMember`, `beforeUpdateMemberRole`, `afterUpdateMemberRole`): an organization always keeps an owner.
 * - member-api-keys (`beforeRemoveMember`): a removed member's org API keys are revoked.
 *
 * Better Auth options:
 * - disabled-paths: closes `/token` (MCP OAuth), the admin endpoints (`authConfig.admin.exposeAuthEndpoints`) and the org mutations (`authConfig.organizations.exposeAuthEndpoints`).
 * - `revokeCredentialsOnPasswordReset` (`emailAndPassword.onPasswordReset`): a reset ends OAuth tokens and API keys.
 * - client-ip-header (`advanced.ipAddress`): rate limits key on the kit's trusted client IP, never a client-sent X-Forwarded-For.
 */
import { revokeApiKeysForUser, revokeOAuthTokensForUser } from "@fuutu/db";
import type { BetterAuthOptions } from "better-auth";
import {
	createAuthMiddleware,
	getOAuthState,
	getSessionFromCtx,
} from "better-auth/api";
import type { OrganizationOptions } from "better-auth/plugins";
import { authConfig } from "../config";
import {
	assertDesktopClientRequest,
	clearDesktopConsentAfterSignIn,
	ensureDesktopClient,
} from "../desktop-oauth";
import { beforeUserDelete } from "../hooks/account-deletion";
import { logApiKeysRevoked } from "../hooks/audit";
import { assertDeleteUserReauth } from "../hooks/delete-user-reauth";
import { notifyPreviousEmailAfterChange } from "../hooks/email-change-notice";
import { assertSessionForEmailVerification } from "../hooks/email-verification-session";
import { assertFreshSession } from "../hooks/fresh-session";
import { assertNotImpersonating } from "../hooks/impersonation-guard";
import {
	assertImpersonationActive,
	isEndedImpersonationResult,
} from "../hooks/impersonation-session";
import { assertInvitationForSignup } from "../hooks/invitation-only";
import {
	assertOwnerRemainsAfterRemoval,
	assertOwnerRemainsAfterRoleChange,
	restoreOwnerIfNoneLeft,
} from "../hooks/last-owner";
import {
	assertRegistrationWithinLimits,
	getAuthorizeParams,
	getPromptNoneBlockUrl,
	getUnverifiedErrorRedirect,
} from "../hooks/mcp-oauth-guards";
import {
	revokeOAuthTokensAfterAccountChange,
	revokeOAuthTokensBeforeConsentDelete,
} from "../hooks/mcp-oauth-revocation";
import {
	revokeApiKeysAfterLeave,
	revokeApiKeysOfRemovedMember,
} from "../hooks/member-api-keys";
import { hideInvitationsFromNonInviters } from "../hooks/organization-invitations";
import { assertPasswordPolicy } from "../hooks/password-policy";
import { assertProfileInput } from "../hooks/profile-input";
import {
	assertSecondFactorForNewAccountLink,
	assertSecondFactorForNewSession,
} from "../hooks/second-factor-session";
import { assertSignupPolicy } from "../hooks/signup-policy";
import {
	markMailboxProof,
	revokeUnprovenCredentials,
} from "../hooks/unproven-credentials";
import { assertVerifiedEmailForChange } from "../hooks/verified-email-change";
import { assertVerifiedEmailForCredential } from "../hooks/verified-email-credentials";
import { saasBaseUrl } from "../lib/saas-url";
import { mcpOAuth } from "../mcp-oauth";

export { authIpAddressOptions } from "../client-ip-header";
export {
	composeDisabledPaths,
	ORGANIZATION_INVITATION_READ_PATHS,
	ORGANIZATION_MUTATION_PATHS,
} from "./disabled-paths";

/** Error page for OAuth errors that must not go back to the client. */
const getErrorPageUrl = (context: {
	baseURL: string;
	options: { onAPIError?: { errorURL?: string } };
}) => context.options.onAPIError?.errorURL || `${context.baseURL}/error`;

/** Better Auth `hooks`: the request guards and response filters above. */
export const securityHooks = {
	before: createAuthMiddleware(async (ctx) => {
		assertPasswordPolicy(ctx.path, ctx.body);
		await assertNotImpersonating({
			path: ctx.path,
			getSession: () => getSessionFromCtx(ctx),
		});
		await assertProfileInput({
			path: ctx.path,
			body: ctx.body,
			getSession: () => getSessionFromCtx(ctx),
		});
		await assertFreshSession({
			path: ctx.path,
			getSession: () => getSessionFromCtx(ctx),
		});
		await assertVerifiedEmailForChange({
			path: ctx.path,
			getSession: () => getSessionFromCtx(ctx),
		});
		await assertVerifiedEmailForCredential({
			path: ctx.path,
			getSession: () => getSessionFromCtx(ctx),
		});
		await assertSessionForEmailVerification({
			enabled: !authConfig.signup.requireEmailVerification,
			path: ctx.path,
			query: ctx.query,
			secret: ctx.context.secret,
			appBaseUrl: saasBaseUrl,
			getSession: () => getSessionFromCtx(ctx),
			redirect: (url) => ctx.redirect(url),
		});
		await assertDeleteUserReauth({
			path: ctx.path,
			body: ctx.body,
			getSession: () => getSessionFromCtx(ctx),
			hasPassword: async (userId) =>
				Boolean(
					(await ctx.context.internalAdapter.findCredentialAccount(userId))
						?.password,
				),
		});
		await assertImpersonationActive({
			path: ctx.path,
			getSession: () => getSessionFromCtx(ctx),
		});
		if (!mcpOAuth.active) return;

		// Desktop app client (config.features.desktop): registered on first use.
		if (ctx.path === "/oauth2/authorize" || ctx.path === "/oauth2/token") {
			assertDesktopClientRequest(
				ctx.path,
				getAuthorizeParams(ctx.query, ctx.body),
			);
			await ensureDesktopClient();
		}

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
		const withoutInvitations = hideInvitationsFromNonInviters({
			path: ctx.path,
			returned: ctx.context.returned,
			userId: ctx.context.session?.user.id,
		});
		if (withoutInvitations) return ctx.json(withoutInvitations);
		await notifyPreviousEmailAfterChange({
			path: ctx.path,
			token: ctx.query?.token,
			returned: ctx.context.returned,
			secret: ctx.context.secret,
		});
		if (
			await isEndedImpersonationResult({
				path: ctx.path,
				returned: ctx.context.returned,
			})
		) {
			return ctx.json(null);
		}
		await revokeApiKeysAfterLeave({
			path: ctx.path,
			returned: ctx.context.returned,
			body: ctx.body,
			userId: ctx.context.session?.user.id,
		});
		if (!mcpOAuth.active) return;
		await clearDesktopConsentAfterSignIn({ path: ctx.path, body: ctx.body });
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
} satisfies NonNullable<BetterAuthOptions["hooks"]>;

/**
 * The security part of Better Auth `databaseHooks`; `index.ts` runs it
 * before the lifecycle side effects (audit, payments, mail, active org).
 */
export const securityDatabaseHooks = {
	user: {
		create: {
			before: async (user, ctx) => {
				// authConfig.signup gate (enabled / allowedDomains) on
				// self-service paths, then the invitation-only gate.
				assertSignupPolicy({ email: user.email }, ctx);
				await assertInvitationForSignup({ email: user.email }, ctx);
			},
		},
		delete: {
			before: async (user) => {
				// Sole owners are refused; subscriptions are cancelled before
				// the user row is deleted — a failed cancel aborts.
				await beforeUserDelete(user.id);
			},
		},
		// Magic link / email OTP proving the mailbox of an unverified
		// account: the squatter's passkeys, 2FA, API keys and OAuth tokens
		// go with its password (hooks/unproven-credentials.ts).
		update: {
			before: async (data, ctx) =>
				markMailboxProof(data, ctx, {
					twoFactor: authConfig.features.twoFactor,
				}),
			after: async (user, ctx) => {
				const adapter = ctx?.context.adapter;
				const deleteRows = async (model: string, userId: string) => {
					await adapter?.deleteMany({
						model,
						where: [{ field: "userId", value: userId }],
					});
				};
				await revokeUnprovenCredentials(user, ctx, {
					deletePasskeys: async (id) => {
						if (authConfig.features.passkeys) await deleteRows("passkey", id);
					},
					deleteTwoFactor: async (id) => {
						if (authConfig.features.twoFactor) {
							await deleteRows("twoFactor", id);
						}
					},
					revokeApiKeys: async (id) => {
						await logApiKeysRevoked({
							userId: id,
							count: await revokeApiKeysForUser(id),
							reason: "mailbox_proof",
						});
					},
					revokeOAuthTokens: async (id) => {
						if (mcpOAuth.active) await revokeOAuthTokensForUser(id);
					},
				});
			},
		},
	},
	account: {
		create: {
			// A refused social sign-in must not leave the provider account
			// linked to a 2FA user (hooks/second-factor-session.ts).
			before: async (account, ctx) => {
				if (!authConfig.features.twoFactor || !ctx) return;
				await assertSecondFactorForNewAccountLink({
					path: ctx.path,
					userId: account.userId,
					isLinkFlow: async () =>
						Boolean((await getOAuthState().catch(() => null))?.link),
					findUser: (id) => ctx.context.internalAdapter.findUserById(id),
					errorPageUrl: () => getErrorPageUrl(ctx.context),
					redirect: (url) => ctx.redirect(url),
				});
			},
		},
	},
	session: {
		create: {
			// Magic link / social sign-in never skip a user's 2FA
			// (hooks/second-factor-session.ts).
			before: async (session, ctx) => {
				if (!authConfig.features.twoFactor || !ctx) return;
				await assertSecondFactorForNewSession({
					path: ctx.path,
					userId: session.userId,
					findUser: (id) => ctx.context.internalAdapter.findUserById(id),
					errorPageUrl: () => getErrorPageUrl(ctx.context),
					redirect: (url) => ctx.redirect(url),
				});
			},
		},
	},
} satisfies NonNullable<BetterAuthOptions["databaseHooks"]>;

/**
 * The security part of the organization plugin's `organizationHooks`;
 * `index.ts` adds the seat limits and payment syncs around it.
 */
export const securityOrganizationHooks = {
	beforeRemoveMember: async ({ member }) => {
		await assertOwnerRemainsAfterRemoval({ member });
		await revokeApiKeysOfRemovedMember(member);
	},
	// The organization always keeps an owner (hooks/last-owner.ts).
	beforeUpdateMemberRole: async ({ member, newRole }) => {
		await assertOwnerRemainsAfterRoleChange({ member, newRole });
	},
	afterUpdateMemberRole: async ({ member, previousRole }) => {
		await restoreOwnerIfNoneLeft({ member, previousRole });
	},
} satisfies NonNullable<OrganizationOptions["organizationHooks"]>;

/**
 * `emailAndPassword.onPasswordReset`: MCP refresh tokens and API keys
 * outlive sessions — a reset (account recovery) must cut off connected
 * OAuth clients and keys minted with a stolen session too (audited: org
 * integrations stop).
 */
export async function revokeCredentialsOnPasswordReset({
	user,
}: {
	user: { id: string };
}): Promise<void> {
	if (mcpOAuth.active) await revokeOAuthTokensForUser(user.id);
	await logApiKeysRevoked({
		userId: user.id,
		count: await revokeApiKeysForUser(user.id),
		reason: "password_reset",
	});
}
