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
	/**
	 * Desktop app releases (`config.features.desktop`): private, written by
	 * CI, read only by the saas update/download routes through short-lived
	 * URLs — never a client-facing alias.
	 */
	desktopReleases: string;
}

/**
 * Who may read a bucket's objects through `/image-proxy`:
 * - "owner": the object's first key segment must be the viewer's user id,
 *   or an org the viewer belongs to with STORAGE.VIEW (system admins with
 *   ADMIN_ORGANIZATION.VIEW too, for support views).
 * - "signed-in": any signed-in user — an explicit opt-in per bucket.
 */
export type StorageReadAccess = "owner" | "signed-in";

export interface StorageConfig {
	provider: StorageProviderId;
	/** Logical → physical bucket name mapping (env-driven). */
	buckets: StorageBuckets;
	/**
	 * Per-bucket max upload size (bytes). Enforced at presign time.
	 * Keyed off `StorageBuckets` so a new logical bucket fails to
	 * compile until its cap is declared.
	 */
	maxUploadBytes: Record<keyof StorageBuckets, number>;
	/**
	 * Per-bucket allowed upload MIME types. Enforced at presign time.
	 * Keyed off `StorageBuckets` for the same reason as above.
	 */
	allowedContentTypes: Record<keyof StorageBuckets, readonly string[]>;
	/** Per-bucket read access through the image proxy (see StorageReadAccess). */
	readAccess: Record<keyof StorageBuckets, StorageReadAccess>;
}

export const storageConfig: StorageConfig = {
	get provider(): StorageProviderId {
		return env.STORAGE_PROVIDER ?? "s3";
	},
	get buckets(): StorageBuckets {
		return {
			avatars: env.S3_BUCKET_AVATARS ?? "avatars",
			organizationLogos:
				env.S3_BUCKET_ORGANIZATION_LOGOS ?? "organization-logos",
			desktopReleases: env.S3_BUCKET_DESKTOP_RELEASES ?? "desktop-releases",
		};
	},
	maxUploadBytes: {
		avatars: 5 * 1024 * 1024, // 5 MB
		organizationLogos: 5 * 1024 * 1024, // 5 MB
		// CI uploads with bucket credentials, never through a presigned URL.
		desktopReleases: 0,
	},
	allowedContentTypes: {
		avatars: ["image/png", "image/jpeg", "image/webp"],
		organizationLogos: ["image/png", "image/jpeg", "image/webp"],
		desktopReleases: [],
	},
	readAccess: {
		// Profile pictures render next to names for other users (member
		// lists, admin tables) — readable by anyone signed in.
		avatars: "signed-in",
		organizationLogos: "owner",
		// Not served by the image proxy (no alias); "owner" fails closed.
		desktopReleases: "owner",
	},
};
