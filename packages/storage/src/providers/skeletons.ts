import type { StorageProvider } from "../types";

/**
 * Skeleton storage providers — inactive in v1.
 *
 * Kept stub-only so a misconfigured deploy fails loudly on first call
 * rather than dropping uploads.
 */
function makeSkeleton(id: string): StorageProvider {
	// Async so callers always get a rejected promise — a synchronous
	// throw inside a `Promise<...>` method would break `await`/`try-catch`
	// expectations of the StorageProvider contract.
	const notImpl = (fn: string) => async () => {
		throw new Error(
			`[storage:${id}] ${fn}() not implemented — skeleton provider.`,
		);
	};
	return {
		id,
		getSignedUploadUrl: notImpl("getSignedUploadUrl") as never,
		getSignedDownloadUrl: notImpl("getSignedDownloadUrl") as never,
		deleteObject: notImpl("deleteObject") as never,
		listObjects: notImpl("listObjects") as never,
	};
}

export const supabaseStorageProvider = makeSkeleton("supabase");
export const noopStorageProvider = makeSkeleton("noop");
