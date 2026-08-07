import type { StorageProvider } from "../types";

/**
 * Skeleton storage providers — inactive in v1.
 *
 * Kept stub-only so a misconfigured deploy fails loudly on first call
 * rather than dropping uploads.
 */
function makeSkeleton(id: string): StorageProvider {
	const notImpl = (fn: string) => () => {
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

export const r2StorageProvider = makeSkeleton("r2");
export const supabaseStorageProvider = makeSkeleton("supabase");
export const noopStorageProvider = makeSkeleton("noop");
