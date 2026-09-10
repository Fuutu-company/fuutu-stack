import { makeSession, makeUser } from "@fuutu/test-utils";
import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../context";
import { storageRouter } from "../modules/storage/router";

vi.mock("@fuutu/storage", () => ({
	resolveStorageProvider: vi.fn(),
	resolveBucket: vi.fn((bucket: string) => bucket),
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
			{ bucket: "avatars", key: "avatar.png", contentType: "image/png" },
			{ context: authenticatedContext },
		);

		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith({
			bucket: "avatars",
			key: "user-1/avatar.png",
			contentType: "image/png",
			contentLength: undefined,
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
				organizationId: "org-1",
			},
			{ context: authenticatedContext },
		);

		expect(mockProvider.getSignedUploadUrl).toHaveBeenCalledWith({
			bucket: "avatars",
			key: "org-1/logo.png",
			contentType: "image/png",
			contentLength: undefined,
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
		});
	});

	it("rejects empty bucket", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{ bucket: "", key: "test.png", contentType: "image/png" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("rejects unconfigured bucket name", async () => {
		const { resolveBucket } = await import("@fuutu/storage");
		vi.mocked(resolveBucket).mockImplementation(() => {
			throw new Error("Bucket not configured");
		});
		vi.mocked(resolveStorageProvider).mockReturnValue(mockProvider as never);

		await expect(
			call(
				storageRouter.upload.createPresigned,
				{
					bucket: "secret-backups",
					key: "test.png",
					contentType: "image/png",
				},
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();

		vi.mocked(resolveBucket).mockImplementation((b: string) => b);
	});

	it("rejects empty key", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{ bucket: "avatars", key: "", contentType: "image/png" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
	});

	it("throws UNAUTHORIZED when unauthenticated", async () => {
		await expect(
			call(
				storageRouter.upload.createPresigned,
				{ bucket: "avatars", key: "test.png", contentType: "image/png" },
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
				{ bucket: "", key: "test.png" },
				{ context: authenticatedContext },
			),
		).rejects.toBeDefined();
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
