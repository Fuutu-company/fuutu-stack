import { resolveStorageProvider } from "@fuutu/storage";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

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

export const deleteObject = protectedProcedure
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
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
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
