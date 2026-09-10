import { resolveBucket, StorageBucketError } from "@fuutu/storage";
import { ORPCError } from "@orpc/server";

/**
 * Resolve a client-supplied bucket name to a configured physical bucket.
 * Throws `ORPCError("BAD_REQUEST")` when the bucket is not allowed,
 * so oRPC returns a clean 400 instead of a 500 INTERNAL_SERVER_ERROR.
 */
export function resolveBucketOrThrow(bucket: string): string {
	try {
		return resolveBucket(bucket);
	} catch (e) {
		if (e instanceof StorageBucketError) {
			throw new ORPCError("BAD_REQUEST", { message: e.message });
		}
		throw e;
	}
}
