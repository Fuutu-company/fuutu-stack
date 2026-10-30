import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
	S3ServiceException,
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
	StorageStreamResult,
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

/**
 * Hard cap on list pagination — a misbehaving backend that keeps
 * returning a `NextContinuationToken` would otherwise loop forever.
 */
const MAX_LIST_PAGES = 100;

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
		if (input.maxSizeBytes !== undefined) {
			if (input.maxSizeBytes <= 0) {
				throw new Error(
					"[storage:s3] maxSizeBytes must be positive when provided.",
				);
			}
			// A presigned PUT can only pin an exact Content-Length, never a
			// range — so `maxSizeBytes` is a validation cap, not something we
			// can sign into the URL. Enforcing it therefore requires the
			// declared `contentLength`.
			if (input.contentLength === undefined) {
				throw new Error(
					"[storage:s3] contentLength is required when maxSizeBytes is set.",
				);
			}
			if (input.contentLength > input.maxSizeBytes) {
				throw new Error(
					`[storage:s3] contentLength (${input.contentLength}) exceeds maxSizeBytes (${input.maxSizeBytes}).`,
				);
			}
		}
		// Bake the declared Content-Length into the signature. The client
		// must send that same length or S3 rejects the upload with
		// SignatureDoesNotMatch — closing the "signed URL, unbounded
		// upload" hole.
		const signedContentLength = input.contentLength;
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
		// ListObjectsV2 returns at most 1000 objects per call — paginate on
		// IsTruncated/NextContinuationToken so results are never silently
		// truncated.
		const objects: StorageObject[] = [];
		let continuationToken: string | undefined;
		let pages = 0;
		do {
			pages += 1;
			if (pages > MAX_LIST_PAGES) {
				throw new Error(
					`[storage:s3] listObjects exceeded ${MAX_LIST_PAGES} pages for bucket "${bucket}" — aborting (stuck continuation token).`,
				);
			}
			const res = await client.send(
				new ListObjectsV2Command({
					Bucket: bucket,
					Prefix: prefix,
					ContinuationToken: continuationToken,
				}),
			);
			for (const o of res.Contents ?? []) {
				if (o.Key && o.Size !== undefined && o.LastModified) {
					objects.push({
						key: o.Key,
						size: o.Size,
						lastModified: o.LastModified,
					});
				}
			}
			continuationToken = res.IsTruncated
				? res.NextContinuationToken
				: undefined;
		} while (continuationToken);
		return objects;
	},

	async getObjectStream(
		bucket: string,
		key: string,
	): Promise<StorageStreamResult | null> {
		const client = getClient();
		try {
			const res = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key }),
			);
			// AWS SDK v3 returns a Node Readable with SdkStreamMixin in the
			// Node runtime — transformToWebStream() yields a true web stream.
			const body = res.Body?.transformToWebStream();
			if (!body) return null;
			return {
				body,
				contentType: res.ContentType ?? null,
				contentLength: res.ContentLength ?? null,
			};
		} catch (err) {
			if (
				err instanceof S3ServiceException &&
				(err.name === "NoSuchKey" || err.name === "NotFound")
			) {
				log.warn("getObjectStream miss", { bucket, key });
				return null;
			}
			log.error("getObjectStream failed", { bucket, key, err });
			throw err;
		}
	},
};
