import { describe, expect, it, vi } from "vitest";

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
	resolveBucket,
	resolveMaxUploadBytes,
	resolveStorageProvider,
	StorageBucketError,
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
			.mockReturnValue("bogus" as never);
		try {
			expect(() => resolveStorageProvider()).toThrow(
				'unknown provider "bogus"',
			);
		} finally {
			providerSpy.mockRestore();
		}
	});
});
