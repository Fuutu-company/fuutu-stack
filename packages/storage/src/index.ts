import { createLogger } from "@fuutu/logs";
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
export { fetchObjectStream, s3StorageProvider } from "./providers/s3";
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

const log = createLogger({ scope: "storage:resolve" });

export class StorageStreamUnavailableError extends Error {
	constructor(providerId: string) {
		super(
			`Storage provider '${providerId}' does not support object streaming.`,
		);
		this.name = "StorageStreamUnavailableError";
	}
}

/**
 * Resolve the active storage provider from `storageConfig.provider`.
 */
export function resolveStorageProvider(): StorageProvider {
	const providerId =
		typeof storageConfig.provider === "function"
			? storageConfig.provider()
			: storageConfig.provider;
	switch (providerId) {
		case "s3":
			return s3StorageProvider;
		case "supabase":
			return supabaseStorageProvider;
		case "noop":
			return noopStorageProvider;
		default:
			log.warn(`unknown provider "${providerId}", falling back to noop.`);
			return noopStorageProvider;
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
