import type { StorageBuckets } from "./config";
import { storageConfig } from "./config";
import { s3StorageProvider } from "./providers/s3";
import {
	noopStorageProvider,
	supabaseStorageProvider,
} from "./providers/skeletons";
import type { StorageProvider, StorageStreamResult } from "./types";

export {
	type StorageBuckets,
	type StorageConfig,
	type StorageProviderId,
	storageConfig,
} from "./config";
export { s3StorageProvider } from "./providers/s3";
export {
	noopStorageProvider,
	supabaseStorageProvider,
} from "./providers/skeletons";
export type {
	SignedDownloadInput,
	SignedUploadInput,
	SignedUploadResult,
	StorageObject,
	StorageProvider,
	StorageStreamResult,
} from "./types";

/**
 * Public bucket aliases — the only bucket identifiers clients may send.
 * They are the same kebab-case names used in `/image-proxy/<alias>/…`
 * URLs; the server maps them to env-driven physical bucket names so
 * clients never need to know (or be able to probe) the real buckets.
 */
export const STORAGE_BUCKET_ALIASES = [
	"avatars",
	"organization-logos",
] as const;

export type StorageBucketAlias = (typeof STORAGE_BUCKET_ALIASES)[number];

const ALIAS_TO_LOGICAL: Record<StorageBucketAlias, keyof StorageBuckets> = {
	avatars: "avatars",
	"organization-logos": "organizationLogos",
};

function isStorageBucketAlias(alias: string): alias is StorageBucketAlias {
	return (STORAGE_BUCKET_ALIASES as readonly string[]).includes(alias);
}

export class StorageStreamUnavailableError extends Error {
	constructor(providerId: string) {
		super(
			`Storage provider '${providerId}' does not support object streaming.`,
		);
		this.name = "StorageStreamUnavailableError";
	}
}

/**
 * Thrown when a caller supplies a bucket that is not configured —
 * either an unknown alias or a physical name not in
 * `storageConfig.buckets`.
 */
export class StorageBucketError extends Error {
	constructor(bucket: string, message?: string) {
		super(
			message ??
				`Bucket "${bucket}" is not configured. Allowed: ${Object.values(storageConfig.buckets).join(", ")}.`,
		);
		this.name = "StorageBucketError";
	}
}

/**
 * Thrown when object input is rejected for safety/policy reasons —
 * `..` in keys/prefixes (path traversal) or an upload contentType
 * outside the per-bucket allowlist. Distinct from `StorageBucketError`
 * (which names an unconfigured bucket).
 */
export class StorageInputError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "StorageInputError";
	}
}

/**
 * Resolve a client-facing bucket alias (e.g. `"organization-logos"`)
 * to the configured physical bucket name.
 * Throws `StorageBucketError` for an unknown alias.
 */
export function resolveBucketAlias(alias: string): string {
	if (!isStorageBucketAlias(alias)) {
		throw new StorageBucketError(alias);
	}
	return storageConfig.buckets[ALIAS_TO_LOGICAL[alias]];
}

/**
 * Validates that a client-supplied bucket name is one of the configured
 * physical buckets and returns it. Throws if the bucket is not configured.
 *
 * This is the security gate that prevents clients from requesting presigned
 * URLs or listing/deleting objects in arbitrary S3 buckets. Every API
 * procedure that accepts `bucket` from client input must call this.
 *
 * @param bucket - The bucket name from client input (must match a configured physical bucket)
 * @returns The validated physical bucket name
 * @throws {StorageBucketError} when the bucket is not in `storageConfig.buckets`
 */
export function resolveBucket(bucket: string): string {
	const allowed = Object.values(storageConfig.buckets);
	if (!allowed.includes(bucket)) {
		throw new StorageBucketError(bucket);
	}
	return bucket;
}

function resolveLogicalBucketKey(bucket: string): keyof StorageBuckets {
	const matches = (
		Object.entries(storageConfig.buckets) as [keyof StorageBuckets, string][]
	).filter(([, physical]) => physical === bucket);
	const first = matches[0];
	if (!first) {
		throw new StorageBucketError(bucket);
	}
	// Two logical buckets sharing one physical name would silently apply
	// the wrong size/MIME policy to one of them — fail loudly instead.
	if (matches.length > 1) {
		throw new StorageBucketError(
			bucket,
			`Physical bucket "${bucket}" is mapped by multiple logical buckets (${matches
				.map(([logical]) => logical)
				.join(", ")}). Configure a distinct physical name per logical bucket.`,
		);
	}
	return first[0];
}

/**
 * Returns the configured upload-size cap (bytes) for a physical bucket
 * name. Same gate as `resolveBucket` — throws `StorageBucketError` when
 * the bucket is not in `storageConfig.buckets`.
 */
export function resolveMaxUploadBytes(bucket: string): number {
	return storageConfig.maxUploadBytes[resolveLogicalBucketKey(bucket)];
}

/**
 * Returns the allowed upload MIME types for a physical bucket name.
 * Same gate as `resolveBucket` — throws `StorageBucketError` when the
 * bucket is not in `storageConfig.buckets`.
 */
export function resolveAllowedContentTypes(bucket: string): readonly string[] {
	return storageConfig.allowedContentTypes[resolveLogicalBucketKey(bucket)];
}

/**
 * SigV4 presigned URLs are hard-capped at 7 days — a larger
 * `expiresInSeconds` produces a URL S3 rejects on use.
 */
const SIGV4_MAX_EXPIRES_IN_SECONDS = 604_800;

function assertSafeKey(key: string): void {
	if (!key) {
		throw new StorageInputError("Storage key must not be empty.");
	}
	if (key.includes("..")) {
		throw new StorageInputError(`Storage key "${key}" must not contain "..".`);
	}
}

function assertExpiresInSeconds(expiresInSeconds: number | undefined): void {
	if (
		expiresInSeconds !== undefined &&
		expiresInSeconds > SIGV4_MAX_EXPIRES_IN_SECONDS
	) {
		throw new StorageInputError(
			`expiresInSeconds must not exceed ${SIGV4_MAX_EXPIRES_IN_SECONDS} (SigV4 hard cap).`,
		);
	}
}

/**
 * Wraps a provider with the package-level input guards so validation
 * runs even when kit consumers call `@fuutu/storage` directly instead
 * of going through the API layer:
 * - bucket must be a configured physical bucket (`StorageBucketError`)
 * - keys/prefixes must be non-empty and must not contain `..`
 *   (`StorageInputError`)
 * - upload contentType must be on the bucket allowlist
 *   (`StorageInputError`)
 * - upload contentLength must be a positive integer within the
 *   per-bucket cap — a direct package caller must not be able to
 *   mint an unbounded presigned PUT (`StorageInputError`)
 *
 * Methods stay async so violations surface as rejected promises,
 * matching the `StorageProvider` contract.
 */
function guardStorageProvider(provider: StorageProvider): StorageProvider {
	const guarded: StorageProvider = {
		// Spread first so future non-interface members survive the wrap.
		...provider,
		getSignedUploadUrl: async (input) => {
			resolveBucket(input.bucket);
			assertSafeKey(input.key);
			const allowed = resolveAllowedContentTypes(input.bucket);
			if (!allowed.includes(input.contentType)) {
				throw new StorageInputError(
					`Content type "${input.contentType}" is not allowed for bucket "${input.bucket}".`,
				);
			}
			const maxBytes = resolveMaxUploadBytes(input.bucket);
			if (
				input.contentLength === undefined ||
				!Number.isInteger(input.contentLength) ||
				input.contentLength <= 0 ||
				input.contentLength > maxBytes
			) {
				throw new StorageInputError(
					`contentLength must be a positive integer not exceeding ${maxBytes} bytes for bucket "${input.bucket}".`,
				);
			}
			assertExpiresInSeconds(input.expiresInSeconds);
			// Fail-close the provider: pin the bucket cap when the caller
			// didn't set one so the presigned upload stays bounded. Copy —
			// never mutate the caller's input object.
			return provider.getSignedUploadUrl({
				...input,
				maxSizeBytes: input.maxSizeBytes ?? maxBytes,
			});
		},
		getSignedDownloadUrl: async (input) => {
			resolveBucket(input.bucket);
			assertSafeKey(input.key);
			assertExpiresInSeconds(input.expiresInSeconds);
			return provider.getSignedDownloadUrl(input);
		},
		deleteObject: async (bucket, key) => {
			resolveBucket(bucket);
			assertSafeKey(key);
			return provider.deleteObject(bucket, key);
		},
		listObjects: async (bucket, prefix) => {
			resolveBucket(bucket);
			if (prefix !== undefined) {
				assertSafeKey(prefix);
			}
			return provider.listObjects(bucket, prefix);
		},
	};
	const getStream = provider.getObjectStream;
	if (getStream) {
		guarded.getObjectStream = async (bucket, key) => {
			resolveBucket(bucket);
			assertSafeKey(key);
			return getStream.call(provider, bucket, key);
		};
	}
	return guarded;
}

/**
 * Resolve the active storage provider from `storageConfig.provider`,
 * wrapped with the package-level input guards (see
 * `guardStorageProvider`). Throws when the configured provider id is
 * unknown instead of silently falling back.
 */
export function resolveStorageProvider(): StorageProvider {
	const providerId = storageConfig.provider;
	switch (providerId) {
		case "s3":
			return guardStorageProvider(s3StorageProvider);
		case "supabase":
			return guardStorageProvider(supabaseStorageProvider);
		case "noop":
			return guardStorageProvider(noopStorageProvider);
		default:
			throw new Error(`[storage] unknown provider "${providerId}".`);
	}
}

/**
 * Stream an object from the active provider. Only s3 is implemented in v1;
 * other providers throw so the image-proxy route can bubble a 502.
 */
export async function getObjectStream(
	bucket: string,
	key: string,
): Promise<StorageStreamResult | null> {
	const provider = resolveStorageProvider();
	if (!provider.getObjectStream) {
		throw new StorageStreamUnavailableError(provider.id);
	}
	return provider.getObjectStream(bucket, key);
}
