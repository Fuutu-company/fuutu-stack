import { resolveStorageProvider } from "@fuutu/storage";
import { z } from "zod";
import { permissionProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

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

export const listObjectsProcedure = permissionProcedure("view:storage")
	.route({
		method: "GET",
		path: "/storage/files",
		tags: ["Storage"],
		summary: "List objects",
		description: "Lists objects in a bucket, optionally filtered by prefix.",
	})
	.input(fileListSchema)
	.handler(async ({ input, context }) => {
		let scope: string;
		if (input.organizationId) {
			await requireOrgRole(
				input.organizationId,
				context.user.id,
				"member",
				context.headers,
			);
			scope = input.organizationId;
		} else {
			scope = context.user.id;
		}
		const scopedPrefix = input.prefix
			? `${scope}/${input.prefix}`
			: `${scope}/`;
		const provider = resolveStorageProvider();
		const items = await provider.listObjects(input.bucket, scopedPrefix);
		return { items };
	});
