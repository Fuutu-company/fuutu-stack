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
	S3ServiceException: class MockS3ServiceException extends Error {
		constructor(options: { name?: string; message?: string }) {
			super(options.message ?? "S3 error");
			if (options.name) this.name = options.name;
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
const { testStorageProviderContract } = await import("./provider-contract");

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

	it("rejects when contentLength exceeds maxSizeBytes", async () => {
		await expect(
			s3StorageProvider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 10 * 1024 * 1024,
				maxSizeBytes: 5 * 1024 * 1024,
			}),
		).rejects.toThrow("exceeds maxSizeBytes");
	});

	it("accepts contentLength within maxSizeBytes and still binds exact length", async () => {
		const result = await s3StorageProvider.getSignedUploadUrl({
			bucket: "avatars",
			key: "user-1.webp",
			contentType: "image/webp",
			contentLength: 1024,
			maxSizeBytes: 5 * 1024 * 1024,
		});
		expect(result.headers["content-length"]).toBe("1024");
	});

	it("rejects maxSizeBytes without contentLength — cap is unenforceable", async () => {
		await expect(
			s3StorageProvider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				maxSizeBytes: 5 * 1024 * 1024,
			}),
		).rejects.toThrow("contentLength");
	});

	it("rejects a non-positive maxSizeBytes", async () => {
		await expect(
			s3StorageProvider.getSignedUploadUrl({
				bucket: "avatars",
				key: "user-1.webp",
				contentType: "image/webp",
				contentLength: 1024,
				maxSizeBytes: 0,
			}),
		).rejects.toThrow("maxSizeBytes must be positive");
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

	it("listObjects paginates with ContinuationToken until IsTruncated is false", async () => {
		sendMock.mockClear();
		sendMock
			.mockResolvedValueOnce({
				Contents: [
					{ Key: "a.webp", Size: 100, LastModified: new Date("2025-01-01") },
				],
				IsTruncated: true,
				NextContinuationToken: "token-page-2",
			})
			.mockResolvedValueOnce({
				Contents: [
					{ Key: "b.webp", Size: 200, LastModified: new Date("2025-01-02") },
				],
				IsTruncated: false,
			});

		const objects = await s3StorageProvider.listObjects("avatars", "p/");

		expect(sendMock).toHaveBeenCalledTimes(2);
		const secondCommand = sendMock.mock.calls[1]?.[0] as
			| { input: { ContinuationToken?: string } }
			| undefined;
		expect(secondCommand?.input.ContinuationToken).toBe("token-page-2");
		expect(objects.map((o) => o.key)).toEqual(["a.webp", "b.webp"]);
	});

	it("listObjects aborts after the page cap when the token never advances", async () => {
		sendMock.mockClear();
		sendMock.mockResolvedValue({
			Contents: [
				{ Key: "a.webp", Size: 100, LastModified: new Date("2025-01-01") },
			],
			IsTruncated: true,
			NextContinuationToken: "stuck-token",
		});
		try {
			await expect(
				s3StorageProvider.listObjects("avatars", "p/"),
			).rejects.toThrow(/100 pages/);
			expect(sendMock).toHaveBeenCalledTimes(100);
		} finally {
			sendMock.mockResolvedValue({
				Contents: [
					{
						Key: "file-1.webp",
						Size: 1024,
						LastModified: new Date("2025-01-01"),
					},
				],
			});
		}
	});
});

describe("s3 provider — getObjectStream", () => {
	it("returns the web stream plus metadata on success", async () => {
		sendMock.mockClear();
		const stream = new ReadableStream<Uint8Array>();
		sendMock.mockResolvedValueOnce({
			Body: { transformToWebStream: () => stream },
			ContentType: "image/webp",
			ContentLength: 512,
		});

		const result = await s3StorageProvider.getObjectStream?.(
			"avatars",
			"user-1.webp",
		);

		expect(result?.body).toBe(stream);
		expect(result?.contentType).toBe("image/webp");
		expect(result?.contentLength).toBe(512);
	});

	it("returns null when the object does not exist", async () => {
		sendMock.mockClear();
		const { S3ServiceException } = await import("@aws-sdk/client-s3");
		for (const name of ["NoSuchKey", "NotFound"]) {
			sendMock.mockRejectedValueOnce(
				new S3ServiceException({
					name,
					message: "missing",
					$fault: "server",
					$metadata: {},
				}),
			);
			await expect(
				s3StorageProvider.getObjectStream?.("avatars", "gone.webp"),
			).resolves.toBeNull();
		}
	});

	it("rethrows non-miss errors", async () => {
		sendMock.mockClear();
		sendMock.mockRejectedValueOnce(new Error("connection reset"));
		await expect(
			s3StorageProvider.getObjectStream?.("avatars", "user-1.webp"),
		).rejects.toThrow("connection reset");
	});
});
