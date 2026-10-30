import { describe, expect, it, vi } from "vitest";
import type { StorageProviderId } from "../index";

vi.mock("@fuutu/env/saas", () => ({
	env: {
		NODE_ENV: "test",
	},
}));

vi.mock("@fuutu/logs", () => ({
	createLogger: () => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	}),
}));

const { storageConfig } = await import("../config");
const {
	getObjectStream,
	resolveAllowedContentTypes,
	resolveBucket,
	resolveBucketAlias,
	resolveMaxUploadBytes,
	resolveStorageProvider,
	StorageBucketError,
	StorageInputError,
	StorageStreamUnavailableError,
} = await import("../index");

describe("resolveBucket", () => {
	it("returns the bucket when it is configured", () => {
		expect(resolveBucket("avatars")).toBe("avatars");
		expect(resolveBucket("organization-logos")).toBe("organization-logos");
	});

	it("throws StorageBucketError for an unconfigured bucket", () => {
		expect(() => resolveBucket("secrets")).toThrow(StorageBucketError);
		expect(() => resolveBucket("secrets")).toThrow(
			'Bucket "secrets" is not configured',
		);
	});
});

describe("resolveBucketAlias", () => {
	it("maps a known alias to the configured physical bucket name", () => {
		expect(resolveBucketAlias("avatars")).toBe("avatars");
		expect(resolveBucketAlias("organization-logos")).toBe("organization-logos");
	});

	it("throws StorageBucketError for an unknown alias", () => {
		expect(() => resolveBucketAlias("secret-backups")).toThrow(
			StorageBucketError,
		);
	});
});

describe("resolveAllowedContentTypes", () => {
	it("returns the image allowlist for a configured bucket", () => {
		expect(resolveAllowedContentTypes("avatars")).toEqual([
			"image/png",
			"image/jpeg",
			"image/webp",
		]);
		expect(resolveAllowedContentTypes("organization-logos")).toEqual([
			"image/png",
			"image/jpeg",
			"image/webp",
		]);
	});

	it("throws StorageBucketError for an unconfigured bucket", () => {
		expect(() => resolveAllowedContentTypes("secrets")).toThrow(
			StorageBucketError,
		);
	});
});

describe("resolveMaxUploadBytes", () => {
	it("returns the configured cap for a configured bucket", () => {
		expect(resolveMaxUploadBytes("avatars")).toBe(5 * 1024 * 1024);
		expect(resolveMaxUploadBytes("organization-logos")).toBe(5 * 1024 * 1024);
	});

	it("throws StorageBucketError for an unconfigured bucket", () => {
		expect(() => resolveMaxUploadBytes("secrets")).toThrow(StorageBucketError);
	});
});

describe("resolveStorageProvider", () => {
	it("resolves the s3 provider by default", () => {
		expect(resolveStorageProvider().id).toBe("s3");
	});

	it("throws for an unknown provider id instead of silently falling back", () => {
		const providerSpy = vi
			.spyOn(storageConfig, "provider", "get")
			.mockReturnValue("bogus" as unknown as StorageProviderId);
		try {
			expect(() => resolveStorageProvider()).toThrow(
				'unknown provider "bogus"',
			);
		} finally {
			providerSpy.mockRestore();
		}
	});
});

describe("guarded provider wrapper", () => {
	it("rejects an unconfigured bucket before delegating", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "secrets",
				key: "user-1.webp",
				contentType: "image/webp",
			}),
		).rejects.toThrow(StorageBucketError);
	});

	it("rejects keys and prefixes containing '..' as StorageInputError", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.deleteObject("avatars", "../escape.webp"),
		).rejects.toThrow(StorageInputError);
		await expect(provider.listObjects("avatars", "../escape")).rejects.toThrow(
			StorageInputError,
		);
		await expect(
			provider.getSignedDownloadUrl({
				bucket: "avatars",
				key: "../escape.webp",
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("rejects a disallowed contentType on getSignedUploadUrl", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.png",
				contentType: "text/html",
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("rejects getSignedUploadUrl without contentLength", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("rejects getSignedUploadUrl when contentLength exceeds the bucket cap", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 6 * 1024 * 1024,
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("rejects getSignedUploadUrl with a non-integer contentLength", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 1024.5,
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("rejects expiresInSeconds above the SigV4 hard cap on upload and download", async () => {
		const provider = resolveStorageProvider();
		await expect(
			provider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 1024,
				expiresInSeconds: 604_801,
			}),
		).rejects.toThrow(StorageInputError);
		await expect(
			provider.getSignedDownloadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				expiresInSeconds: 604_801,
			}),
		).rejects.toThrow(StorageInputError);
	});

	it("does not mutate the caller's upload input when pinning maxSizeBytes", async () => {
		const providerSpy = vi
			.spyOn(storageConfig, "provider", "get")
			.mockReturnValue("noop");
		try {
			const provider = resolveStorageProvider();
			const input = {
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 1024,
			};
			// Reaches the noop provider (which rejects) — the point is that
			// the caller's object is untouched afterwards.
			await expect(provider.getSignedUploadUrl(input)).rejects.toThrow(
				"not implemented",
			);
			expect(input).toEqual({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 1024,
			});
		} finally {
			providerSpy.mockRestore();
		}
	});

	it("delegates to the resolved provider when all guards pass", async () => {
		const providerSpy = vi
			.spyOn(storageConfig, "provider", "get")
			.mockReturnValue("noop");
		try {
			const provider = resolveStorageProvider();
			// The noop skeleton rejects with "not implemented" — reaching it
			// proves the guards passed and the call was delegated.
			await expect(
				provider.getSignedUploadUrl({
					bucket: "avatars",
					key: "user-1.webp",
					contentType: "image/webp",
					contentLength: 1024,
				}),
			).rejects.toThrow("not implemented");
		} finally {
			providerSpy.mockRestore();
		}
	});
});

describe("getObjectStream", () => {
	it("rejects keys containing '..' as StorageInputError", async () => {
		await expect(getObjectStream("avatars", "../escape.webp")).rejects.toThrow(
			StorageInputError,
		);
	});

	it("throws StorageStreamUnavailableError when the provider cannot stream", async () => {
		const providerSpy = vi
			.spyOn(storageConfig, "provider", "get")
			.mockReturnValue("noop");
		try {
			await expect(getObjectStream("avatars", "user-1.webp")).rejects.toThrow(
				StorageStreamUnavailableError,
			);
		} finally {
			providerSpy.mockRestore();
		}
	});
});

describe("ambiguous physical bucket names", () => {
	it("throws StorageBucketError when two logical buckets share a physical name", () => {
		const bucketsSpy = vi
			.spyOn(storageConfig, "buckets", "get")
			.mockReturnValue({
				avatars: "shared-bucket",
				organizationLogos: "shared-bucket",
			});
		try {
			expect(() => resolveMaxUploadBytes("shared-bucket")).toThrow(
				StorageBucketError,
			);
			expect(() => resolveAllowedContentTypes("shared-bucket")).toThrow(
				StorageBucketError,
			);
			expect(() => resolveMaxUploadBytes("shared-bucket")).toThrow(
				/multiple logical buckets/,
			);
		} finally {
			bucketsSpy.mockRestore();
		}
	});
});
