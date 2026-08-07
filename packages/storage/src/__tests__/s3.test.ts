import { describe, expect, it, vi } from "vitest";

// Mock the AWS S3 client at the module boundary — no real network calls.
const sendMock = vi.fn().mockResolvedValue({
	Contents: [
		{ Key: "file-1.webp", Size: 1024, LastModified: new Date("2025-01-01") },
	],
});

vi.mock("@aws-sdk/client-s3", () => ({
	S3Client: class MockS3Client {
		send = sendMock;
	},
	PutObjectCommand: class MockPutObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	},
	GetObjectCommand: class MockGetObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	},
	DeleteObjectCommand: class MockDeleteObjectCommand {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	},
	ListObjectsV2Command: class MockListObjectsV2Command {
		input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	},
}));

vi.mock("@aws-sdk/s3-request-presigner", () => ({
	getSignedUrl: vi
		.fn()
		.mockResolvedValue("https://s3.test/signed-url?signature=abc"),
}));

vi.mock("@fuutu/env/saas", () => ({
	env: {
		S3_ACCESS_KEY_ID: "test-access-key",
		S3_SECRET_ACCESS_KEY: "test-secret-key",
		S3_REGION: "us-east-1",
		S3_ENDPOINT: "http://localhost:9000",
		S3_FORCE_PATH_STYLE: true,
		NODE_ENV: "test",
	},
}));

const { s3StorageProvider } = await import("../providers/s3");
const { testStorageProviderContract } = await import(
	"./provider-contract.test"
);

testStorageProviderContract("s3", () => s3StorageProvider, {
	behavior: "resolves",
});

describe("s3 provider — presigned URL generation", () => {
	it("getSignedUploadUrl returns a presigned URL with headers and expiry", async () => {
		const result = await s3StorageProvider.getSignedUploadUrl({
			bucket: "avatars",
			key: "user-1.webp",
			contentType: "image/webp",
			contentLength: 2048,
		});
		expect(result.url).toBe("https://s3.test/signed-url?signature=abc");
		expect(result.headers["content-type"]).toBe("image/webp");
		expect(result.headers["content-length"]).toBe("2048");
		expect(result.expiresAt).toBeGreaterThan(Date.now());
	});

	it("getSignedDownloadUrl returns a presigned URL string", async () => {
		const url = await s3StorageProvider.getSignedDownloadUrl({
			bucket: "avatars",
			key: "user-1.webp",
		});
		expect(url).toBe("https://s3.test/signed-url?signature=abc");
	});

	it("listObjects maps S3 objects to StorageObject shape", async () => {
		sendMock.mockResolvedValueOnce({
			Contents: [
				{ Key: "a.webp", Size: 100, LastModified: new Date("2025-01-01") },
				{ Key: "b.webp", Size: 200, LastModified: new Date("2025-01-02") },
			],
		});
		const objects = await s3StorageProvider.listObjects("avatars", "a");
		expect(objects).toHaveLength(2);
		expect(objects[0]?.key).toBe("a.webp");
		expect(objects[0]?.size).toBe(100);
		expect(objects[1]?.key).toBe("b.webp");
	});
});
