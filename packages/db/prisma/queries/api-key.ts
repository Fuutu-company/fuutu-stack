import { randomBytes } from "node:crypto";
import { sha256 } from "@fuutu/utils/hash";
import { db } from "../client";

const KEY_PREFIX = "futu_sk_";
const PREFIX_VISIBLE_LEN = 12;

/** Generate a random API key: `futu_sk_<random>`. */
function generateKey(): string {
	const random = randomBytes(24).toString("base64url");
	return `${KEY_PREFIX}${random}`;
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
		},
	});
	return { id: record.id, key, prefix: record.prefix };
};

export const listApiKeys = (
	userId: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	return db.apiKey.findMany({
		where: { userId, revokedAt: null },
		orderBy: { createdAt: "desc" },
		take,
		skip,
		omit: { key: true },
	});
};

export const countApiKeys = (userId: string) =>
	db.apiKey.count({ where: { userId, revokedAt: null } });

export const listOrgApiKeys = (
	organizationId: string,
	opts: { take?: number; skip?: number } = {},
) => {
	const { take = 50, skip = 0 } = opts;
	return db.apiKey.findMany({
		where: { organizationId, revokedAt: null },
		orderBy: { createdAt: "desc" },
		take,
		skip,
		omit: { key: true },
	});
};

export const countOrgApiKeys = (organizationId: string) =>
	db.apiKey.count({ where: { organizationId, revokedAt: null } });

/**
 * Verify a plaintext API key. Hashes the key internally with sha256 (matching
 * `createApiKey`) before looking it up. Returns the record when valid (not
 * revoked, not expired) and updates `lastUsedAt`. Returns `null` otherwise.
 */
export const verifyApiKey = async (plaintextKey: string) => {
	const hashedKey = await sha256(plaintextKey);
	const record = await db.apiKey.findUnique({ where: { key: hashedKey } });
	if (!record) return null;
	if (record.revokedAt) return null;
	if (record.expiresAt && record.expiresAt < new Date()) return null;

	await db.apiKey.update({
		where: { id: record.id },
		data: { lastUsedAt: new Date() },
	});
	return record;
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
