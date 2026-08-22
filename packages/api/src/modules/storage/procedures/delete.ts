import { PERMISSIONS } from "@fuutu/rbac";
import { resolveStorageProvider } from "@fuutu/storage";
import { z } from "zod";
import { createRateLimitMiddleware, permissionProcedure } from "../../../orpc";
import { requireOrgPermissionAccess } from "../../organizations/shared";

const fileDeleteSchema = z.object({
	bucket: z.string().min(1),
	key: z
		.string()
		.min(1)
		.refine((k) => !k.includes(".."), {
			message: "Path traversal not allowed",
		}),
	organizationId: z.string().optional(),
});

export const deleteObject = permissionProcedure(PERMISSIONS.STORAGE.DELETE)
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
		let prefix: string;
		if (input.organizationId) {
			await requireOrgPermissionAccess(
				input.organizationId,
				context.user.id,
				PERMISSIONS.STORAGE.DELETE,
				context.headers,
			);
			prefix = input.organizationId;
		} else {
			prefix = context.user.id;
		}
		const scopedKey = `${prefix}/${input.key}`;
		const provider = resolveStorageProvider();
		await provider.deleteObject(input.bucket, scopedKey);
		return { success: true };
	});
