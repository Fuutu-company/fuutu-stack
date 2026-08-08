import { createLogger } from "@fuutu/logs";
import { storageConfig } from "./config";
import { fetchObjectStream, s3StorageProvider } from "./providers/s3";
import {
	noopStorageProvider,
	r2StorageProvider,
	supabaseStorageProvider,
} from "./providers/skeletons";
import type { StorageProvider } from "./types";

export {
	type StorageBuckets,
	type StorageConfig,
	type StorageProviderId,
	storageConfig,
} from "./config";
export { fetchObjectStream, s3StorageProvider } from "./providers/s3";
export {
	noopStorageProvider,
	r2StorageProvider,
	supabaseStorageProvider,
} from "./providers/skeletons";
export type {
	SignedDownloadInput,
	SignedUploadInput,
	SignedUploadResult,
	StorageObject,
	StorageProvider,
} from "./types";

const log = createLogger({ scope: "storage:resolve" });

/**
 * Resolve the active storage provider from `storageConfig.provider`.
 */
export function resolveStorageProvider(): StorageProvider {
	switch (storageConfig.provider) {
		case "s3":
			return s3StorageProvider;
		case "r2":
			return r2StorageProvider;
		case "supabase":
			return supabaseStorageProvider;
		case "noop":
			return noopStorageProvider;
		default:
			log.warn(
				`unknown provider "${storageConfig.provider}", falling back to noop.`,
			);
			return noopStorageProvider;
	}
}

/**
 * Stream an object from the active provider. Only s3 is implemented in v1;
 * other providers throw so the image-proxy route can bubble a 502.
 */
export async function getObjectStream(bucket: string, key: string) {
	if (storageConfig.provider !== "s3") {
		throw new Error(
			`[storage] getObjectStream is only implemented for the s3 provider (got "${storageConfig.provider}").`,
		);
	}
	return fetchObjectStream(bucket, key);
}
