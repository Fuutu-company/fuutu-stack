/**
 * Storage configuration — owned by @fuutu/storage.
 *
 * v1: S3-compatible provider with MinIO as the local dev backend.
 */
export type StorageProviderId = "s3" | "r2" | "supabase" | "noop";

export interface StorageBuckets {
	avatars: string;
	organizationLogos: string;
}

export interface StorageConfig {
	provider: StorageProviderId;
	/** Default expiry for signed upload URLs (seconds). */
	defaultUploadExpiry: number;
	/** Default expiry for signed download URLs (seconds). */
	defaultDownloadExpiry: number;
	/** Logical → physical bucket name mapping. */
	buckets: StorageBuckets;
	/** Per-bucket max upload size (bytes). Enforced at presign time. */
	maxUploadBytes: {
		avatars: number;
		organizationLogos: number;
	};
}

export const storageConfig: StorageConfig = {
	provider: "s3",
	defaultUploadExpiry: 600,
	defaultDownloadExpiry: 600,
	buckets: {
		avatars: "avatars",
		organizationLogos: "organization-logos",
	},
	maxUploadBytes: {
		avatars: 5 * 1024 * 1024, // 5 MB
		organizationLogos: 5 * 1024 * 1024, // 5 MB
	},
};
