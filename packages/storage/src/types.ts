/**
 * @fuutu/storage — provider-agnostic object storage interface.
 *
 * Every provider speaks to S3-compatible APIs conceptually (S3, R2,
 * Backblaze B2, MinIO) or wraps a bucket-like service (Supabase
 * Storage). Concrete provider files live in `./providers/*` and expose
 * a `StorageProvider` instance.
 *
 * The interface intentionally exposes only presigned-URL flows and
 * server-side delete/list. No direct `putObject` in here — all uploads
 * go through presigned URLs so the app never proxies file bytes.
 */

export interface SignedUploadInput {
	bucket: string;
	/** Key inside the bucket, e.g. `avatars/user-123.webp`. */
	key: string;
	/** MIME type — Content-Type the uploader must send. */
	contentType: string;
	/**
	 * Exact size the uploader will send, in bytes. When provided the
	 * provider MUST bind the value to the presigned URL so S3 rejects
	 * any upload of a different length (fixes the "signed URL,
	 * unbounded upload" hole).
	 */
	contentLength?: number;
	/** Max allowed size in bytes (enforced via presign policy). */
	maxSizeBytes?: number;
	/** Seconds until the URL expires. Defaults to 600 (10 min). */
	expiresInSeconds?: number;
}

export interface SignedDownloadInput {
	bucket: string;
	key: string;
	/** Seconds until the URL expires. Defaults to 600 (10 min). */
	expiresInSeconds?: number;
}

export interface SignedUploadResult {
	/** PUT URL the client uploads the file to. */
	url: string;
	/** Headers the client MUST include when PUTting (Content-Type etc.). */
	headers: Record<string, string>;
	/** Absolute expiry timestamp (ms epoch). */
	expiresAt: number;
}

export interface StorageObject {
	key: string;
	size: number;
	lastModified: Date;
}

export interface StorageProvider {
	readonly id: string;
	getSignedUploadUrl(input: SignedUploadInput): Promise<SignedUploadResult>;
	getSignedDownloadUrl(input: SignedDownloadInput): Promise<string>;
	deleteObject(bucket: string, key: string): Promise<void>;
	listObjects(bucket: string, prefix?: string): Promise<StorageObject[]>;
}
