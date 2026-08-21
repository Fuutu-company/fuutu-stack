/**
 * Storage configuration — owned by @fuutu/storage.
 *
 * v1: S3-compatible provider with MinIO as the local dev backend.
 *
 * Bucket names are env-driven so each environment (dev, staging, prod)
 * can point to its own physical buckets. This is critical when multiple
 * environments share the same S3-compatible service (e.g. a single MinIO
 * instance): dev buckets can be named `dev_avatars`, prod buckets
 * `prod_avatars`, etc. — all controlled via env vars, no code changes.
 */
import { env } from "@fuutu/env/saas";

export type StorageProviderId = "s3" | "supabase" | "noop";

export interface StorageBuckets {
	avatars: string;
	organizationLogos: string;
}

export interface StorageConfig {
	provider: StorageProviderId | (() => StorageProviderId);
	/** Default expiry for signed upload URLs (seconds). */
	defaultUploadExpiry: number;
	/** Default expiry for signed download URLs (seconds). */
	defaultDownloadExpiry: number;
	/** Logical → physical bucket name mapping (env-driven). */
	buckets: StorageBuckets;
	/** Per-bucket max upload size (bytes). Enforced at presign time. */
	maxUploadBytes: {
		avatars: number;
		organizationLogos: number;
	};
}

export const storageConfig: StorageConfig = {
	get provider(): StorageProviderId {
		return env.STORAGE_PROVIDER ?? "s3";
	},
	defaultUploadExpiry: 600,
	defaultDownloadExpiry: 600,
	get buckets(): StorageBuckets {
		return {
			avatars: env.S3_BUCKET_AVATARS ?? "avatars",
			organizationLogos:
				env.S3_BUCKET_ORGANIZATION_LOGOS ?? "organization-logos",
		};
	},
	maxUploadBytes: {
		avatars: 5 * 1024 * 1024, // 5 MB
		organizationLogos: 5 * 1024 * 1024, // 5 MB
	},
};
