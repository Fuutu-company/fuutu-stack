import { auth } from "@fuutu/auth";
import { verifyApiKeyWithOwner } from "@fuutu/db";
import type { Context as HonoContext } from "hono";

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

export async function createContext({ context }: CreateContextOptions) {
	const headers = context.req.raw.headers as Headers;
	let session = await auth.api.getSession({ headers });
	let apiKey: ApiKeyAuth | null = null;

	if (!session) {
		const rawKey = headers.get(API_KEY_HEADER);
		if (rawKey) {
			const verified = await verifyApiKeyWithOwner(rawKey);
			if (verified && !verified.user.banned) {
				session = toApiKeySession(asSessionUser(verified.user));
				apiKey = {
					id: verified.apiKey.id,
					organizationId: verified.apiKey.organizationId,
				};
			}
		}
	}
	return { session, headers, apiKey };
}

export type Context = {
	session: Awaited<ReturnType<typeof auth.api.getSession>>;
	headers: Headers;
	apiKey: ApiKeyAuth | null;
};
