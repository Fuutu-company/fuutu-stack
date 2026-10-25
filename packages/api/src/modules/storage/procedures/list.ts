import { PERMISSIONS } from "@fuutu/rbac";
import { resolveStorageProvider, STORAGE_BUCKET_ALIASES } from "@fuutu/storage";
import { z } from "zod";
import { authProcedure } from "../../../orpc/procedures";
import { callStorageOrThrow, resolveBucketOrThrow } from "../shared";

const fileListSchema = z.object({
	bucket: z.enum(STORAGE_BUCKET_ALIASES),
	prefix: z
		.string()
		.optional()
		.refine((p) => !p?.includes(".."), {
			message: "Path traversal not allowed",
		}),
	organizationId: z.string().optional(),
});

export const listObjectsProcedure = authProcedure({
	systemPermission: PERMISSIONS.STORAGE.VIEW,
	org: { permission: PERMISSIONS.STORAGE.VIEW, optional: true },
})
	.route({
		method: "GET",
		path: "/storage/files",
		tags: ["Storage"],
		summary: "List objects",
		description: "Lists objects in a bucket, optionally filtered by prefix.",
	})
	.input(fileListSchema)
	.handler(async ({ input, context }) => {
		const bucket = resolveBucketOrThrow(input.bucket);
		const scope = context.org?.id ?? context.user.id;
		const scopedPrefix = input.prefix
			? `${scope}/${input.prefix}`
			: `${scope}/`;
		const provider = resolveStorageProvider();
		// The guarded provider re-validates bucket/prefix — violations
		// surface as BAD_REQUEST via callStorageOrThrow.
		const items = await callStorageOrThrow(() =>
			provider.listObjects(bucket, scopedPrefix),
		);
		return { items };
	});
