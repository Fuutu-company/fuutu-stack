import { resolveStorageProvider } from "@fuutu/storage";
import { z } from "zod";
import { createRateLimitMiddleware, protectedProcedure } from "../../../orpc";
import { requireOrgRole } from "../../organizations/shared";

const BLOCKED_EXTENSIONS: readonly string[] = [
	".exe",
	".bat",
	".cmd",
	".sh",
	".php",
	".js",
	".mjs",
	".html",
	".svg",
	".jar",
	".war",
	".app",
	".com",
	".scr",
	".msi",
	".ps1",
];

const uploadCreatePresignedSchema = z.object({
	bucket: z.string().min(1),
	key: z
		.string()
		.min(1)
		.refine((k) => !k.includes(".."), {
			message: "Path traversal not allowed",
		})
		.refine(
			(k) => {
				const lastDotIndex = k.lastIndexOf(".");
				if (lastDotIndex === -1) return true; // No extension, allow
				const ext = k.slice(lastDotIndex).toLowerCase();
				return !BLOCKED_EXTENSIONS.includes(ext);
			},
			{
				message:
					"Executable file extensions are not allowed for security reasons",
			},
		),
	contentType: z.string().min(1),
	contentLength: z.number().int().min(0).optional(),
	organizationId: z.string().optional(),
});

export const createPresigned = protectedProcedure
	.use(createRateLimitMiddleware({ endpoint: "storageMutation" }))
	.route({
		method: "POST",
		path: "/storage/upload/presigned",
		tags: ["Storage"],
		summary: "Create presigned upload URL",
		description:
			"Returns a presigned URL for direct file upload to the storage provider.",
	})
	.input(uploadCreatePresignedSchema)
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
		const result = await provider.getSignedUploadUrl({
			bucket: input.bucket,
			key: scopedKey,
			contentType: input.contentType,
			contentLength: input.contentLength,
		});
		return result;
	});
