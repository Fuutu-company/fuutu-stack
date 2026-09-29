import { PERMISSIONS } from "@fuutu/rbac";
import { resolveMaxUploadBytes, resolveStorageProvider } from "@fuutu/storage";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { authProcedure, createRateLimitMiddleware } from "../../../orpc";
import { resolveBucketOrThrow } from "../shared";

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
	// Declared size is required: it is both validated against the
	// per-bucket cap below and bound into the presigned URL, so the
	// client cannot upload a different size.
	contentLength: z.number().int().positive(),
	organizationId: z.string().optional(),
});

export const createPresigned = authProcedure({
	systemPermission: PERMISSIONS.STORAGE.CREATE,
	org: { permission: PERMISSIONS.STORAGE.CREATE, optional: true },
})
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
		const bucket = resolveBucketOrThrow(input.bucket);
		// resolveBucketOrThrow already proved the bucket is configured, so
		// resolveMaxUploadBytes cannot throw here.
		const maxBytes = resolveMaxUploadBytes(bucket);
		if (input.contentLength > maxBytes) {
			throw new ORPCError("PAYLOAD_TOO_LARGE", {
				message: "File exceeds the maximum upload size.",
			});
		}
		const prefix = context.org?.id ?? context.user.id;
		const scopedKey = `${prefix}/${input.key}`;
		const provider = resolveStorageProvider();
		const result = await provider.getSignedUploadUrl({
			bucket,
			key: scopedKey,
			contentType: input.contentType,
			contentLength: input.contentLength,
			maxSizeBytes: maxBytes,
		});
		return result;
	});
