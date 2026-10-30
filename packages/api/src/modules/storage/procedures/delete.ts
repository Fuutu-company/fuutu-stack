import { PERMISSIONS } from "@fuutu/rbac";
import { resolveStorageProvider, STORAGE_BUCKET_ALIASES } from "@fuutu/storage";
import { z } from "zod";
import { createRateLimitMiddleware } from "../../../orpc/middleware/rate-limit";
import { authProcedure } from "../../../orpc/procedures";
import { callStorageOrThrow, resolveBucketOrThrow } from "../shared";

const fileDeleteSchema = z.object({
	bucket: z.enum(STORAGE_BUCKET_ALIASES),
	key: z
		.string()
		.min(1)
		.refine((k) => !k.includes(".."), {
			message: "Path traversal not allowed",
		}),
	organizationId: z.string().optional(),
});

export const deleteObject = authProcedure({
	systemPermission: PERMISSIONS.STORAGE.DELETE,
	org: { permission: PERMISSIONS.STORAGE.DELETE, optional: true },
})
	.use(createRateLimitMiddleware({ endpoint: "storageMutation" }))
	.route({
		method: "DELETE",
		path: "/storage/file",
		tags: ["Storage"],
		summary: "Delete object",
		description: "Deletes an object from the storage provider.",
	})
	.input(fileDeleteSchema)
	.handler(async ({ input, context }) => {
		const bucket = resolveBucketOrThrow(input.bucket);
		const prefix = context.org?.id ?? context.user.id;
		const scopedKey = `${prefix}/${input.key}`;
		const provider = resolveStorageProvider();
		// The guarded provider re-validates bucket/key — violations
		// surface as BAD_REQUEST via callStorageOrThrow.
		await callStorageOrThrow(() => provider.deleteObject(bucket, scopedKey));
		return { success: true };
	});
