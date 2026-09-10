import { expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type {
	SignedDownloadInput,
	SignedUploadInput,
	StorageProvider,
} from "../types";

describe("provider-contract", () => {
	it("module loads", () => {
		expect(true).toBe(true);
	});
});

export interface StorageProviderContractOptions {
	/** Whether the provider methods resolve or throw. */
	readonly behavior: "resolves" | "throws";
	/** Substring expected in thrown error messages (skeletons). */
	readonly throwsContains?: string;
}

/**
 * Shared contract every StorageProvider must satisfy.
 * Called from one test file per provider so every swap candidate is covered.
 */
export function testStorageProviderContract(
	id: string,
	createProvider: () => StorageProvider,
	options: StorageProviderContractOptions,
): void {
	const uploadInput: SignedUploadInput = {
		bucket: "test-bucket",
		key: "avatars/user-1.webp",
		contentType: "image/webp",
	};
	const downloadInput: SignedDownloadInput = {
		bucket: "test-bucket",
		key: "avatars/user-1.webp",
	};

	describe(`StorageProvider contract — ${id}`, () => {
		it("exposes a non-empty id", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.id);
		});

		if (options.behavior === "resolves") {
			it("getSignedUploadUrl() returns { url, headers, expiresAt }", async () => {
				const provider = createProvider();
				const result = await provider.getSignedUploadUrl(uploadInput);
				expect(typeof result.url).toBe("string");
				expect(result.url.length).toBeGreaterThan(0);
				expect(typeof result.headers).toBe("object");
				expect(typeof result.expiresAt).toBe("number");
			});

			it("getSignedDownloadUrl() returns a string URL", async () => {
				const provider = createProvider();
				const url = await provider.getSignedDownloadUrl(downloadInput);
				expect(typeof url).toBe("string");
				expect(url.length).toBeGreaterThan(0);
			});

			it("deleteObject() resolves", async () => {
				const provider = createProvider();
				await expect(
					provider.deleteObject("test-bucket", "avatars/user-1.webp"),
				).resolves.toBeUndefined();
			});

			it("listObjects() returns an array", async () => {
				const provider = createProvider();
				const objects = await provider.listObjects("test-bucket");
				expect(Array.isArray(objects)).toBe(true);
			});
		} else {
			it("getSignedUploadUrl() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.getSignedUploadUrl(uploadInput))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("getSignedDownloadUrl() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.getSignedDownloadUrl(downloadInput))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("deleteObject() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.deleteObject("test-bucket", "key"))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("listObjects() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.listObjects("test-bucket"))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});
		}
	});
}
