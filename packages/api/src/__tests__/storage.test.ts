import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { storageRouter } from "../modules/storage/router";

vi.mock("@fuutu/storage", () => ({
	resolveStorageProvider: vi.fn(),
	resolveBucketAlias: vi.fn((alias: string) => alias),
	resolveMaxUploadBytes: vi.fn(() => 5 * 1024 * 1024),
	STORAGE_BUCKET_ALIASES: ["avatars", "organization-logos"],
	StorageBucketError: class StorageBucketError extends Error {},
	StorageInputError: class StorageInputError extends Error {},
}));

vi.mock("@fuutu/ai", () => ({
	resolveAIProvider: vi.fn(),
}));

vi.mock("@fuutu/auth", () => ({
	auth: {
		api: {
			getFullOrganization: vi.fn(),
		},
	},
}));

vi.mock("@fuutu/db", () => ({
	db: {},
}));

const { resolveStorageProvider } = await import("@fuutu/storage");
const { auth } = await import("@fuutu/auth");

const authenticatedContext = makeSession<Context>(makeUser());
const unauthenticatedContext = makeSession<Context>(null);

const mockProvider = {
	id: "s3",
	getSignedUploadUrl: vi.fn(),
	getSignedDownloadUrl: vi.fn(),
	deleteObject: vi.fn(),
	listObjects: vi.fn(),
};

const orgFixture = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	createdAt: new Date("2024-01-01"),
	members: [{ userId: "user-1", role: "owner", id: "member-1" }],
	invitations: [],
};

function mockOrgMembership() {
	vi.mocked(auth.api.getFullOrganization).mockResolvedValue(
		orgFixture as never,
	);
}

describe("storage.upload.createPresigned", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a presigned upload URL scoped to the user", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.getSignedUploadUrl.mockResolvedValue({
			url: "https://s3.example.com/upload",
			headers: { "content-type": "image/png" },
			expiresAt: Date.now() + 600000,
		});

		const result = await call(
			storageRouter.upload.createPresigned,
			{
				bucket: "avatars",
				key: "avatar.png",
				contentType: "image/png",
				contentLength: 2048,
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith({
			bucket: "avatars",
			key: "user-1/avatar.png",
			contentType: "image/png",
			contentLength: 2048,
			maxSizeBytes: 5 * 1024 * 1024,
		});
		expect(result).toMatchObject({ url: "https://s3.example.com/upload" });
	});

	it("scopes the key to organizationId when provided", async () => {
		mockOrgMembership();
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.getSignedUploadUrl.mockResolvedValue({
			url: "https://s3.example.com/upload",
			headers: {},
			expiresAt: Date.now() + 600000,
		});

		await call(
			storageRouter.upload.createPresigned,
			{
				bucket: "avatars",
				key: "logo.png",
				contentType: "image/png",
				contentLength: 2048,
				organizationId: "org-1",
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith({
			bucket: "avatars",
			key: "org-1/logo.png",
			contentType: "image/png",
			contentLength: 2048,
			maxSizeBytes: 5 * 1024 * 1024,
		});
	});

	it("passes contentLength when provided", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.getSignedUploadUrl.mockResolvedValue({
			url: "https://s3.example.com/upload",
			headers: {},
			expiresAt: Date.now() + 600000,
		});

		await call(
			storageRouter.upload.createPresigned,
			{
				bucket: "avatars",
				key: "avatar.png",
				contentType: "image/png",
				contentLength: 1024,
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith({
			bucket: "avatars",
			key: "user-1/avatar.png",
			contentType: "image/png",
			contentLength: 1024,
			maxSizeBytes: 5 * 1024 * 1024,
		});
	});

	it("rejects when contentLength is missing", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "avatar.png",
					contentType: "image/png",
				} as never,
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects contentLength above the bucket cap", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "huge.png",
					contentType: "image/png",
					contentLength: 6 * 1024 * 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "PAYLOAD_TOO_LARGE" });
	});

	it("rejects empty bucket", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "" as never,
					key: "test.png",
					contentType: "image/png",
					contentLength: 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects a traversal key with BAD_REQUEST", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "../escape.png",
					contentType: "image/png",
					contentLength: 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects an unconfigured bucket alias with BAD_REQUEST", async () => {
		const { resolveBucketAlias, StorageBucketError } = await import(
			"@fuutu/storage"
		);
		vi.mocked(resolveBucketAlias).mockImplementationOnce(() => {
			throw new StorageBucketError("unknown alias");
		});
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "test.png",
					contentType: "image/png",
					contentLength: 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a non-image contentType with BAD_REQUEST", async () => {
		const { StorageInputError } = await import("@fuutu/storage");
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.getSignedUploadUrl.mockRejectedValue(
			new StorageInputError("contentType not allowed"),
		);

		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "test.png",
					contentType: "text/html",
					contentLength: 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects empty key", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "",
					contentType: "image/png",
					contentLength: 1024,
				},
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "avatars",
					key: "test.png",
					contentType: "image/png",
					contentLength: 1024,
				},
				{ context: unauthenticatedContext },
			),
		).rejects.toMatchObject({ code: "UNAUTHORIZED" });
	});
});

describe("storage.file.delete", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("deletes an object scoped to the user", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.deleteObject.mockResolvedValue(undefined);

		const result = await call(
			storageRouter.file.delete,
			{ bucket: "avatars", key: "avatar.png" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.deleteObject).toHaveBeenCalledWith(
			"avatars",
			"user-1/avatar.png",
		);
		expect(result).toEqual({ success: true });
	});

	it("scopes the key to organizationId when provided", async () => {
		mockOrgMembership();
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.deleteObject.mockResolvedValue(undefined);

		await call(
			storageRouter.file.delete,
			{ bucket: "avatars", key: "logo.png", organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.deleteObject).toHaveBeenCalledWith(
			"avatars",
			"org-1/logo.png",
		);
	});

	it("rejects empty bucket", async () => {
		await expect(
			call(
				storageRouter.file.delete,
				{ bucket: "" as never, key: "test.png" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects a traversal key with BAD_REQUEST", async () => {
		await expect(
			call(
				storageRouter.file.delete,
				{ bucket: "avatars", key: "../escape.png" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("storage.file.list", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists objects scoped to the user prefix", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.listObjects.mockResolvedValue([
			{
				key: "user-1/avatar.png",
				size: 1024,
				lastModified: new Date("2024-01-01"),
			},
		]);

		const result = await call(
			storageRouter.file.list,
			{ bucket: "avatars" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.listObjects).toHaveBeenCalledWith("avatars", "user-1/");
		expect(result).toEqual({
			items: [
				{
					key: "user-1/avatar.png",
					size: 1024,
					lastModified: new Date("2024-01-01"),
				},
			],
		});
	});

	it("passes prefix scoped to the user when provided", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.listObjects.mockResolvedValue([]);

		await call(
			storageRouter.file.list,
			{ bucket: "avatars", prefix: "photos/" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.listObjects).toHaveBeenCalledWith(
			"avatars",
			"user-1/photos/",
		);
	});

	it("scopes prefix to organizationId when provided", async () => {
		mockOrgMembership();
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.listObjects.mockResolvedValue([]);

		await call(
			storageRouter.file.list,
			{ bucket: "avatars", organizationId: "org-1" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.listObjects).toHaveBeenCalledWith("avatars", "org-1/");
	});

	it("rejects a traversal prefix with BAD_REQUEST", async () => {
		await expect(
			call(
				storageRouter.file.list,
				{ bucket: "avatars", prefix: "../" },
				{ context: authenticatedContext },
			),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("returns empty items when bucket is empty", async () => {
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.listObjects.mockResolvedValue([]);

		const result = await call(
			storageRouter.file.list,
			{ bucket: "avatars" },
			{ context: authenticatedContext },
		);

		expect(result).toEqual({ items: [] });
	});
});

describe("organization-logos bucket — writes need ORGANIZATION.UPDATE", () => {
	const withRole = (role: string) =>
		vi.mocked(auth.api.getFullOrganization).mockResolvedValue({
			...orgFixture,
			members: [{ userId: "user-1", role, id: "member-1" }],
		} as never);

	const presignLogo = (organizationId?: string) =>
		call(
			storageRouter.upload.createPresigned,
			{
				bucket: "organization-logos",
				key: "logo.png",
				contentType: "image/png",
				contentLength: 2048,
				...(organizationId ? { organizationId } : {}),
			},
			{ context: authenticatedContext },
		);

	const deleteLogo = (organizationId?: string) =>
		call(
			storageRouter.file.delete,
			{
				bucket: "organization-logos",
				key: "logo.png",
				...(organizationId ? { organizationId } : {}),
			},
			{ context: authenticatedContext },
		);

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);
		mockProvider.getSignedUploadUrl.mockResolvedValue({
			url: "https://s3.example.com/upload",
			headers: {},
			expiresAt: Date.now() + 600000,
		});
		mockProvider.deleteObject.mockResolvedValue(undefined);
	});

	it("rejects a plain member's logo upload", async () => {
		withRole("member");
		await expect(presignLogo("org-1")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(mockProvider.getSignedUploadUrl).not.toHaveBeenCalled();
	});

	it("rejects a plain member's logo delete", async () => {
		withRole("member");
		await expect(deleteLogo("org-1")).rejects.toMatchObject({
			code: "FORBIDDEN",
		});
		expect(mockProvider.deleteObject).not.toHaveBeenCalled();
	});

	it("rejects logo writes outside an organization", async () => {
		await expect(presignLogo()).rejects.toMatchObject({ code: "FORBIDDEN" });
		await expect(deleteLogo()).rejects.toMatchObject({ code: "FORBIDDEN" });
		expect(mockProvider.getSignedUploadUrl).not.toHaveBeenCalled();
		expect(mockProvider.deleteObject).not.toHaveBeenCalled();
	});

	it("lets an org admin upload and delete the logo", async () => {
		withRole("admin");
		await presignLogo("org-1");
		await deleteLogo("org-1");
		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith(
			expect.objectContaining({ key: "org-1/logo.png" }),
		);
		expect(mockProvider.deleteObject).toHaveBeenCalledWith(
			"organization-logos",
			"org-1/logo.png",
		);
	});

	it("still lets a plain member write other buckets in the org", async () => {
		withRole("member");
		await call(
			storageRouter.upload.createPresigned,
			{
				bucket: "avatars",
				key: "a.png",
				contentType: "image/png",
				contentLength: 10,
				organizationId: "org-1",
			},
			{ context: authenticatedContext },
		);
		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalled();
	});
});
