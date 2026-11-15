import { auth } from "@fuutu/auth";
import {
	type ImpersonationSessionLike,
	isImpersonationExpired,
} from "@fuutu/auth/impersonation";
import { isBanActive } from "@fuutu/auth/types";
import { API_KEY_PREFIX, getUserAccessState } from "@fuutu/db";
import {
	hasSystemPermission,
	PERMISSIONS,
	SYSTEM_POLICY,
	SystemAccessControl,
	toSystemRole,
} from "@fuutu/rbac";
import type { Context as HonoContext } from "hono";
import { API_SCOPE } from "./api-key-scopes";
import {
	findMissingScopeFeature,
	type MissingScopeFeature,
} from "./modules/api-keys/scope-feature";
import { verifyApiKeyCredential } from "./modules/api-keys/verify-credential";
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

const systemAC = new SystemAccessControl(SYSTEM_POLICY);

/**
 * An impersonation lasts only while the impersonating admin may still
 * impersonate — a demotion, ban or deletion ends it at once, not when the
 * cookie-cached session runs out. One DB read, impersonation sessions only.
 * Cost: one primary-key user read per request of an impersonation session.
 */
async function hasImpersonatorLostAccess({
	impersonatedBy,
}: ImpersonationSessionLike): Promise<boolean> {
	if (!impersonatedBy) return false;
	const impersonator = await getUserAccessState(impersonatedBy);
	return (
		!impersonator ||
		isBanActive(impersonator) ||
		!hasSystemPermission(
			systemAC,
			toSystemRole(impersonator.role),
			PERMISSIONS.IMPERSONATE_USER,
		)
	);
}

export async function createContext({ context }: CreateContextOptions) {
	const headers = context.req.raw.headers as Headers;
	let session = await auth.api.getSession({ headers });
	// A support impersonation ends after authConfig.admin.impersonationMinutes
	// even though Better Auth still holds the session row and cookies.
	if (
		session &&
		(isImpersonationExpired(session.session) ||
			(await hasImpersonatorLostAccess(session.session)))
	) {
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
	return {
		session,
		headers,
		apiKey,
		apiKeyUpgradeRequired,
		preAuthRateLimited,
	};
}

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
	/**
	 * Response headers of the current call, injected by oRPC's
	 * `ResponseHeadersPlugin` (orpc/handler.ts) — e.g. Better Auth
	 * Set-Cookie headers for impersonation. Absent under `call()`.
	 */
	resHeaders?: Headers;
};
