import { createLogger } from "@fuutu/logs";
import { type KnownPermission, PERMISSIONS } from "@fuutu/rbac";
import {
	resolveBucketAlias,
	type StorageBucketAlias,
	StorageBucketError,
	StorageInputError,
} from "@fuutu/storage";
import { ORPCError } from "@orpc/server";
import { requireOrgPermission } from "../../orpc/org-access";

const log = createLogger({ scope: "storage" });

function isStorageValidationError(
	e: unknown,
): e is StorageBucketError | StorageInputError {
	return e instanceof StorageBucketError || e instanceof StorageInputError;
}

/**
 * Resolve a client-supplied bucket alias (e.g. `"avatars"`,
 * `"organization-logos"`) to the configured physical bucket name.
 * Throws `ORPCError("BAD_REQUEST")` when the alias is unknown,
 * so oRPC returns a clean 400 instead of a 500 INTERNAL_SERVER_ERROR.
 */
export function resolveBucketOrThrow(alias: string): string {
	try {
		return resolveBucketAlias(alias);
	} catch (e) {
		if (isStorageValidationError(e)) {
			log.warn("bucket resolution failed", { err: e });
			throw new ORPCError("BAD_REQUEST", { message: "Invalid bucket" });
		}
		throw e;
	}
}

/**
 * Run a storage provider call, mapping validation errors thrown by the
 * guarded provider (unknown bucket, unsafe key, disallowed content
 * type) to `ORPCError("BAD_REQUEST")` instead of a 500.
 */
export async function callStorageOrThrow<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (e) {
		if (isStorageValidationError(e)) {
			log.warn("storage input rejected", { err: e });
			throw new ORPCError("BAD_REQUEST", {
				message: "Invalid storage request",
			});
		}
		throw e;
	}
}

/**
 * Org permission a bucket's writes and deletes need on top of
 * STORAGE.CREATE / STORAGE.DELETE. A bucket listed here is org-only: its
 * objects are shared org assets, so a plain member must not replace them.
 */
export const BUCKET_WRITE_ORG_PERMISSION: Partial<
	Record<StorageBucketAlias, KnownPermission>
> = {
	"organization-logos": PERMISSIONS.ORGANIZATION.UPDATE,
};

/** Throws FORBIDDEN when the caller may not write/delete in `alias`. */
export function requireBucketWriteAccess(
	alias: StorageBucketAlias,
	context: { membership?: { role: string | null | undefined } },
): void {
	const permission = BUCKET_WRITE_ORG_PERMISSION[alias];
	if (!permission) return;
	if (!context.membership) {
		throw new ORPCError("FORBIDDEN", {
			message: "This bucket is organization-scoped",
		});
	}
	requireOrgPermission(context.membership, permission);
}
