import { PERMISSIONS } from "@fuutu/rbac";
import { resolveStorageProvider } from "@fuutu/storage";
import { z } from "zod";
import { authProcedure } from "../../../orpc";
import { resolveBucketOrThrow } from "../shared";

const fileListSchema = z.object({
	bucket: z.string().min(1),
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
		const items = await provider.listObjects(bucket, scopedPrefix);
		return { items };
	});
