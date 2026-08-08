import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@fuutu/env/saas";
import { createLogger } from "@fuutu/logs";
import type {
	SignedDownloadInput,
	SignedUploadInput,
	SignedUploadResult,
	StorageObject,
	StorageProvider,
} from "../types";

/**
 * S3 storage provider — v1 active.
 *
 * Works against any S3-compatible endpoint (AWS S3, MinIO, R2, Backblaze).
 * MinIO is used for local development via `packages/db/docker-compose.yml`.
 *
 * We intentionally keep the client inside a module-level cache: creating
 * a new `S3Client` per request is expensive (credential resolution, TLS
 * handshakes) and the client is safe to share across concurrent requests.
 */
const log = createLogger({ scope: "storage:s3" });

let _client: S3Client | null = null;

function getClient(): S3Client {
	if (_client) return _client;
	if (!env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
		throw new Error(
			"[storage:s3] S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are required.",
		);
	}
	// MinIO (and most local S3-compatibles) require path-style addressing.
	// Auto-detect by endpoint host so a fresh clone works without the dev
	// having to set `S3_FORCE_PATH_STYLE=true` — explicit env value still
	// wins when provided.
	const endpoint = env.S3_ENDPOINT;
	const forcePathStyle =
		typeof env.S3_FORCE_PATH_STYLE === "boolean"
			? env.S3_FORCE_PATH_STYLE
			: Boolean(
					endpoint &&
						/^(https?:\/\/)?(localhost|127\.0\.0\.1|minio)(:|\/|$)/i.test(
							endpoint,
						),
				);

	_client = new S3Client({
		region: env.S3_REGION ?? "us-east-1",
		endpoint,
		forcePathStyle,
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY_ID,
			secretAccessKey: env.S3_SECRET_ACCESS_KEY,
		},
	});
	return _client;
}

export const s3StorageProvider: StorageProvider = {
	id: "s3",

	async getSignedUploadUrl(
		input: SignedUploadInput,
	): Promise<SignedUploadResult> {
		const client = getClient();
		const expiresIn = input.expiresInSeconds ?? 600;
		if (input.maxSizeBytes !== undefined && input.maxSizeBytes <= 0) {
			throw new Error(
				"[storage:s3] maxSizeBytes must be positive when provided.",
			);
		}
		// Bake the exact Content-Length into the signature. The client
		// must then send that same length or S3 rejects the upload with
		// SignatureDoesNotMatch — closing the "signed URL, unbounded
		// upload" hole. If the caller did not pre-compute a size, we
		// fall back to per-request cap (`maxSizeBytes`) so tuned bucket
		// policies still enforce the ceiling.
		const signedContentLength = input.contentLength ?? input.maxSizeBytes;
		const command = new PutObjectCommand({
			Bucket: input.bucket,
			Key: input.key,
			ContentType: input.contentType,
			ContentLength: signedContentLength,
		});
		const url = await getSignedUrl(client, command, {
			expiresIn,
			// SDK v3 drops unsigned headers from the generated URL unless
			// we force `content-length` into the signature.
			unhoistableHeaders: new Set(["content-length"]),
		});
		log.info("presigned upload", {
			bucket: input.bucket,
			key: input.key,
			expiresIn,
			contentLength: signedContentLength,
		});
		const headers: Record<string, string> = {
			"content-type": input.contentType,
		};
		if (signedContentLength !== undefined) {
			headers["content-length"] = String(signedContentLength);
		}
		return {
			url,
			headers,
			expiresAt: Date.now() + expiresIn * 1000,
		};
	},

	async getSignedDownloadUrl({
		bucket,
		key,
		expiresInSeconds = 600,
	}: SignedDownloadInput): Promise<string> {
		const client = getClient();
		const command = new GetObjectCommand({ Bucket: bucket, Key: key });
		return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
	},

	async deleteObject(bucket: string, key: string): Promise<void> {
		const client = getClient();
		await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
	},

	async listObjects(bucket: string, prefix?: string): Promise<StorageObject[]> {
		const client = getClient();
		const res = await client.send(
			new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
		);
		return (res.Contents ?? [])
			.filter(
				(o): o is Required<Pick<typeof o, "Key" | "Size" | "LastModified">> =>
					Boolean(o.Key && o.Size !== undefined && o.LastModified),
			)
			.map((o) => ({
				key: o.Key,
				size: o.Size,
				lastModified: o.LastModified,
			}));
	},
};

/**
 * Stream an object directly from S3 — used by the image-proxy route in
 * `apps/saas` for private buckets (avoids exposing signed URLs on the
 * public web surface).
 */
export async function fetchObjectStream(
	bucket: string,
	key: string,
): Promise<{
	body: ReadableStream<Uint8Array>;
	contentType: string | undefined;
	contentLength: number | undefined;
} | null> {
	const client = getClient();
	try {
		const res = await client.send(
			new GetObjectCommand({ Bucket: bucket, Key: key }),
		);
		const body = res.Body as ReadableStream<Uint8Array> | undefined;
		if (!body) return null;
		return {
			body,
			contentType: res.ContentType,
			contentLength: res.ContentLength,
		};
	} catch (err) {
		// Distinguish legitimate 404 (object does not exist) from every
		// other failure (AccessDenied, NoSuchBucket, network) — the
		// image-proxy must not map a misconfigured IAM policy to a silent
		// 404 because that obscures real ops problems.
		const name = (err as { name?: string }).name ?? "";
		if (name === "NoSuchKey" || name === "NotFound") {
			log.warn("fetchObjectStream miss", { bucket, key });
			return null;
		}
		log.error("fetchObjectStream failed", {
			bucket,
			key,
			name,
			err: String(err),
		});
		throw err;
	}
}
