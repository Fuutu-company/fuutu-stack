import { randomBytes } from "node:crypto";
import { sha256 } from "@fuutu/utils/hash";
import { db } from "../client";
import { withSerializationRetry } from "./transaction";

/** Prefix of every org API key (`futu_sk_…`). */
export const API_KEY_PREFIX = "futu_sk_";
const PREFIX_VISIBLE_LEN = 12;

/** Generate a random API key: `futu_sk_<random>`. */
function generateKey(): string {
	const random = randomBytes(24).toString("base64url");
	return `${API_KEY_PREFIX}${random}`;
}

/** Build the visible prefix shown in the UI (e.g. `futu_sk_abc...`). */
function buildPrefix(key: string): string {
	const visible = key.slice(0, PREFIX_VISIBLE_LEN);
	return `${visible}...`;
}

export type CreatedApiKey = {
	id: string;
	/** Plaintext key — only returned once at creation time. */
	key: string;
	prefix: string;
};

export const createApiKey = async (
	userId: string,
	name: string,
	organizationId?: string | null,
	expiresAt?: Date | null,
	scopes: string[] = [],
): Promise<CreatedApiKey> => {
	const key = generateKey();
	const hashed = await sha256(key);
	const record = await db.apiKey.create({
		data: {
			key: hashed,
			prefix: buildPrefix(key),
			name,
			userId,
			organizationId: organizationId ?? null,
			expiresAt: expiresAt ?? null,
			scopes,
		},
	});
	return { id: record.id, key, prefix: record.prefix };
};

/**
 * Create an API key while enforcing a plan limit atomically — the count
 * check and the insert run inside one Serializable transaction so two
 * concurrent requests cannot both pass the check (TOCTOU). The limit
 * counts org keys for org-scoped creates and user keys otherwise,
 * matching the `limit` pre-check in the authorize middleware.
 * Returns `null` when the limit is already reached.
 */
export const createApiKeyWithinLimit = (params: {
	userId: string;
	name: string;
	organizationId?: string | null;
	expiresAt?: Date | null;
	scopes?: string[];
	max: number | null;
}): Promise<CreatedApiKey | null> => {
	const { userId, name, organizationId, expiresAt, scopes = [], max } = params;
	return withSerializationRetry(() =>
		db.$transaction(
			async (tx) => {
				const count = await tx.apiKey.count({
					where: {
						...(organizationId ? { organizationId } : { userId }),
						revokedAt: null,
					},
				});
				if (max !== null && count >= max) return null;
				const key = generateKey();
				const hashed = await sha256(key);
				const record = await tx.apiKey.create({
					data: {
						key: hashed,
						prefix: buildPrefix(key),
						name,
						userId,
						organizationId: organizationId ?? null,
						expiresAt: expiresAt ?? null,
						scopes,
					},
				});
				return { id: record.id, key, prefix: record.prefix };
			},
			{ isolationLevel: "Serializable" },
		),
	);
};

/** Only keys whose `scopes` list this scope (unset → no filter). */
const scopeFilter = (scope?: string) =>
	scope ? { scopes: { has: scope } } : {};

export const listApiKeys = (
	userId: string,
	opts: {
		take?: number;
		skip?: number;
		/** Exclude org keys the user created. */
		personalOnly?: boolean;
		/** Only keys carrying this scope. */
		scope?: string;
	} = {},
) => {
	const { take = 50, skip = 0, personalOnly = false, scope } = opts;
	return db.apiKey.findMany({
		where: {
			userId,
			revokedAt: null,
			...(personalOnly ? { organizationId: null } : {}),
			...scopeFilter(scope),
		},
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		take,
		skip,
		omit: { key: true },
	});
};

export const countApiKeys = (
	userId: string,
	opts: { personalOnly?: boolean; scope?: string } = {},
) =>
	db.apiKey.count({
		where: {
			userId,
			revokedAt: null,
			...(opts.personalOnly ? { organizationId: null } : {}),
			...scopeFilter(opts.scope),
		},
	});

export const listOrgApiKeys = (
	organizationId: string,
	opts: { take?: number; skip?: number; scope?: string } = {},
) => {
	const { take = 50, skip = 0, scope } = opts;
	return db.apiKey.findMany({
		where: { organizationId, revokedAt: null, ...scopeFilter(scope) },
		orderBy: [{ createdAt: "desc" }, { id: "asc" }],
		take,
		skip,
		omit: { key: true },
	});
};

export const countOrgApiKeys = (
	organizationId: string,
	opts: { scope?: string } = {},
) =>
	db.apiKey.count({
		where: { organizationId, revokedAt: null, ...scopeFilter(opts.scope) },
	});

/** `lastUsedAt` is written at most this often per key — not on every request. */
const LAST_USED_WRITE_INTERVAL_MS = 60 * 1000;

/**
 * Verify a plaintext API key. Hashes the key internally with sha256 (matching
 * `createApiKey`) before looking it up. Returns the record when valid (not
 * revoked, not expired) and updates `lastUsedAt` (at most once a minute).
 * Returns `null` otherwise.
 */
export const verifyApiKey = async (plaintextKey: string) => {
	const hashedKey = await sha256(plaintextKey);
	const record = await db.apiKey.findUnique({ where: { key: hashedKey } });
	if (!record) return null;
	if (record.revokedAt) return null;
	const now = new Date();
	if (record.expiresAt && record.expiresAt < now) return null;

	if (
		!record.lastUsedAt ||
		now.getTime() - record.lastUsedAt.getTime() >= LAST_USED_WRITE_INTERVAL_MS
	) {
		await db.apiKey.update({
			where: { id: record.id },
			data: { lastUsedAt: now },
		});
	}
	return record;
};

/**
 * Verify a plaintext API key AND resolve its owning user in one call.
 * Used by the oRPC context to authenticate `x-api-key` requests —
 * the key acts with the owner's permissions (optionally org-scoped).
 */
export const verifyApiKeyWithOwner = async (plaintextKey: string) => {
	const apiKey = await verifyApiKey(plaintextKey);
	if (!apiKey) return null;
	const user = await db.user.findUnique({ where: { id: apiKey.userId } });
	if (!user) return null;
	return { apiKey, user };
};

export type ApiKeyOwner = { userId: string } | { organizationId: string };

export const getApiKey = (id: string) =>
	db.apiKey.findUnique({ where: { id }, omit: { key: true } });

export const revokeApiKey = async (id: string, owner: ApiKeyOwner) => {
	const owned = await db.apiKey.findFirst({ where: { id, ...owner } });
	if (!owned) return null;
	return db.apiKey.update({
		where: { id },
		data: { revokedAt: new Date() },
	});
};

export const deleteApiKey = async (id: string, owner: ApiKeyOwner) => {
	const owned = await db.apiKey.findFirst({ where: { id, ...owner } });
	if (!owned) return null;
	return db.apiKey.delete({ where: { id } });
};

/**
 * Revoke every live key a user holds for an organization — run when the
 * user stops being a member, so the keys cannot come back on a rejoin.
 * Returns the number of keys revoked.
 */
export const revokeOrgApiKeysForUser = async (
	organizationId: string,
	userId: string,
) => {
	const { count } = await db.apiKey.updateMany({
		where: { organizationId, userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
	return count;
};

/**
 * Revoke every live key a user holds, personal and org — run on account
 * recovery (password reset, the mailbox owner taking over an unverified
 * account), so a key minted with a stolen or squatted session dies too.
 * Returns the number of keys revoked.
 */
export const revokeApiKeysForUser = async (userId: string) => {
	const { count } = await db.apiKey.updateMany({
		where: { userId, revokedAt: null },
		data: { revokedAt: new Date() },
	});
	return count;
};
