import { auth } from "@fuutu/auth";
import { desktopOAuth } from "@fuutu/auth/desktop-oauth";
import { isImpersonationExpired } from "@fuutu/auth/impersonation";
import { endImpersonationIfAccessLost } from "@fuutu/auth/impersonation-access";
import { endExpiredImpersonation } from "@fuutu/auth/impersonation-expiry";
import { API_KEY_PREFIX, getOrganizationWithMembers } from "@fuutu/db";
import type { Context as HonoContext } from "hono";
import { API_SCOPE, DESKTOP_SCOPE } from "./api-key-scopes";
import {
	findMissingScopeFeature,
	type MissingScopeFeature,
} from "./modules/api-keys/scope-feature";
import { verifyApiKeyCredential } from "./modules/api-keys/verify-credential";
import {
	type DesktopAuth,
	resolveDesktopBearer,
} from "./modules/desktop/bearer";
import { throttlePreAuth } from "./pre-auth-throttle";

export type CreateContextOptions = {
	context: HonoContext;
};

export const API_KEY_HEADER = "x-api-key";

/**
 * An `x-api-key`-authenticated request. `organizationId` set means the key
 * is org-scoped — it may only act on that org (enforced in runAuthorize
 * and the org-access helpers), never on user-scoped resources.
 */
export type ApiKeyAuth = {
	id: string;
	organizationId: string | null;
	/**
	 * A desktop access token, not an API key: user-level procedures stay
	 * allowed, org access only to `organizationId` (null = no org), and
	 * only on `desktopAllowed` procedures (orpc/procedures.ts).
	 */
	desktop?: true;
};

type SessionResult = Awaited<ReturnType<typeof auth.api.getSession>>;

/**
 * The Prisma user row carries the same columns Better Auth exposes on
 * `session.user` (id, email, role, banned, …). Procedures only read
 * `context.session.user`, so a `{ user }` shape is sufficient — the nested
 * `session` object is never dereferenced for API-key requests.
 */
const toApiKeySession = (
	user: NonNullable<SessionResult>["user"],
): SessionResult => ({ user }) as SessionResult;

// The Prisma user row is the same table Better Auth exposes — structural
// superset/subset differences (Date vs ISO fields) are irrelevant at
// runtime, so the single localized cast is safe.
const asSessionUser = (user: unknown): NonNullable<SessionResult>["user"] =>
	user as NonNullable<SessionResult>["user"];

const BEARER_PREFIX = "bearer ";

/**
 * The API-key credential of a request: `Authorization: Bearer futu_sk_…`
 * (same precedence as requireApiKey / MCP), else `x-api-key`. Other bearer
 * tokens are not API keys and are left to their own handlers.
 */
const extractApiKey = (headers: Headers): string | null => {
	const authorization = headers.get("authorization");
	if (authorization?.toLowerCase().startsWith(BEARER_PREFIX)) {
		const token = authorization.slice(BEARER_PREFIX.length).trim();
		if (token.startsWith(API_KEY_PREFIX)) return token;
	}
	return headers.get(API_KEY_HEADER);
};

/**
 * A scoped key is only valid on the surfaces of its scopes — oRPC/REST
 * needs `api`. Unscoped keys are full credentials (documented default).
 */
const isAllowedOnApi = (scopes: readonly string[]): boolean =>
	scopes.length === 0 || scopes.includes(API_SCOPE);

export async function createContext({ context }: CreateContextOptions) {
	const headers = context.req.raw.headers as Headers;
	let session = await auth.api.getSession({ headers });
	// A support impersonation ends after authConfig.admin.impersonationMinutes
	// even though Better Auth still holds the session row and cookies.
	if (session && isImpersonationExpired(session.session)) {
		await endExpiredImpersonation(session.session);
		session = null;
	}
	if (session && (await endImpersonationIfAccessLost(session.session))) {
		session = null;
	}
	let apiKey: ApiKeyAuth | null = null;
	let apiKeyUpgradeRequired: MissingScopeFeature | null = null;
	let preAuthRateLimited: PreAuthRateLimited | null = null;

	if (!session) {
		const rawKey = extractApiKey(headers);
		// A presented key costs a DB lookup before the oRPC rate limit can
		// run — failed checks are counted per client IP; an IP over the
		// budget gets 429 from publicProcedure.
		const attempt = rawKey ? await throttlePreAuth(headers, "orpc") : null;
		if (attempt?.limited) {
			preAuthRateLimited = {
				retryAfter: Number(attempt.limited.headers.get("retry-after") ?? "1"),
			};
		} else if (rawKey && attempt) {
			// Owner ban, org membership and admin-scope role are re-checked
			// on every request (verifyApiKeyCredential) — fail closed.
			const verified = await attempt.verify(() =>
				verifyApiKeyCredential(rawKey),
			);
			if (verified && isAllowedOnApi(verified.apiKey.scopes)) {
				// Same `api` feature gate as requireApiKey; the key stays
				// unauthenticated and publicProcedure answers 402.
				apiKeyUpgradeRequired = await findMissingScopeFeature(
					verified.apiKey.organizationId,
					API_SCOPE,
				);
				if (!apiKeyUpgradeRequired) {
					session = toApiKeySession(asSessionUser(verified.user));
					apiKey = {
						id: verified.apiKey.id,
						organizationId: verified.apiKey.organizationId,
					};
				}
			}
		}
	}
	// Desktop app access token (config.features.desktop, own audience — C1).
	// It authenticates as its user, but narrower than any API key:
	// - pinned to the token's org claim after a membership check (a stale
	//   or missing claim pins to no org) — isOrgInApiKeyScope;
	// - only `desktopAllowed` procedures accept it (orpc/procedures.ts);
	// - the `desktop` scope feature gates it beyond the access flow (402);
	// - `sessionOnly` (money, credentials, org structure) and admin
	//   procedures refuse it.
	let desktop: DesktopAuth | null = null;
	let desktopUpgradeRequired: MissingScopeFeature | null = null;
	if (!session && !apiKey && !preAuthRateLimited && desktopOAuth.active) {
		const bearer = extractBearer(headers);
		if (bearer && !bearer.startsWith(API_KEY_PREFIX)) {
			const attempt = await throttlePreAuth(headers, "desktop");
			if (attempt.limited) {
				preAuthRateLimited = {
					retryAfter: Number(attempt.limited.headers.get("retry-after") ?? "1"),
				};
			} else {
				const resolved = await attempt.verify(() =>
					resolveDesktopBearer(bearer),
				);
				if (resolved) {
					const pinnedOrg = await memberOrgOrNull(
						resolved.desktop.organizationId,
						resolved.user.id,
					);
					session = toApiKeySession(asSessionUser(resolved.user));
					apiKey = {
						id: `oauth:${resolved.desktop.tokenId}`,
						organizationId: pinnedOrg,
						desktop: true,
					};
					desktop = resolved.desktop;
					desktopUpgradeRequired = await findMissingScopeFeature(
						pinnedOrg,
						DESKTOP_SCOPE,
					);
				}
			}
		}
	}
	return {
		session,
		headers,
		apiKey,
		apiKeyUpgradeRequired,
		preAuthRateLimited,
		desktop,
		desktopUpgradeRequired,
	};
}

/** `organizationId` when `userId` is (still) a member, else null — as mcp/principal.ts. */
async function memberOrgOrNull(
	organizationId: string | null,
	userId: string,
): Promise<string | null> {
	if (!organizationId) return null;
	const org = await getOrganizationWithMembers(organizationId);
	return org?.members.some((m) => m.userId === userId) ? organizationId : null;
}

const extractBearer = (headers: Headers): string | null => {
	const authorization = headers.get("authorization");
	if (!authorization?.toLowerCase().startsWith(BEARER_PREFIX)) return null;
	return authorization.slice(BEARER_PREFIX.length).trim() || null;
};

/** Set when a presented key came from an IP over its failed-check budget (seconds until retry). */
export type PreAuthRateLimited = { retryAfter: number };

export type Context = {
	session: Awaited<ReturnType<typeof auth.api.getSession>>;
	headers: Headers;
	apiKey: ApiKeyAuth | null;
	/** Set when a presented API key is valid but its `api` scope is plan-gated. */
	apiKeyUpgradeRequired?: MissingScopeFeature | null;
	/** Set when a presented API key was refused by the pre-auth throttle. */
	preAuthRateLimited?: PreAuthRateLimited | null;
	/** Set when the caller is the desktop app (desktop access token). */
	desktop?: DesktopAuth | null;
	/** Set when a desktop token lacks the `desktop` scope feature (402 beyond the access flow). */
	desktopUpgradeRequired?: MissingScopeFeature | null;
	/**
	 * Response headers of the current call, injected by oRPC's
	 * `ResponseHeadersPlugin` (orpc/handler.ts) — e.g. Better Auth
	 * Set-Cookie headers for impersonation. Absent under `call()`.
	 */
	resHeaders?: Headers;
};
