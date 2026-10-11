import { describe, expect, it } from "vitest";
import {
	noopStorageProvider,
	supabaseStorageProvider,
} from "../providers/skeletons";
import { testStorageProviderContract } from "./provider-contract";

testStorageProviderContract("supabase", () => supabaseStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testStorageProviderContract("noop", () => noopStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

describe("storage skeletons — async contract", () => {
	it("methods return rejected promises instead of throwing synchronously", async () => {
		for (const provider of [supabaseStorageProvider, noopStorageProvider]) {
			const upload = provider.getSignedUploadUrl({
				bucket: "x",
				key: "y",
				contentType: "image/webp",
			});
			expect(upload).toBeInstanceOf(Promise);
			await expect(upload).rejects.toThrow("not implemented");

			const download = provider.getSignedDownloadUrl({
				bucket: "x",
				key: "y",
			});
			expect(download).toBeInstanceOf(Promise);
			await expect(download).rejects.toThrow("not implemented");

			const del = provider.deleteObject("x", "y");
			expect(del).toBeInstanceOf(Promise);
			await expect(del).rejects.toThrow("not implemented");

			const list = provider.listObjects("x");
			expect(list).toBeInstanceOf(Promise);
			await expect(list).rejects.toThrow("not implemented");
		}
	});
});

describe("storage skeletons — error messages name the provider", () => {
	it("supabase names the provider in the error", async () => {
		await expect(
			(async () =>
				supabaseStorageProvider.getSignedUploadUrl({
					bucket: "x",
					key: "y",
					contentType: "image/webp",
				}))(),
		).rejects.toThrow("[storage:supabase]");
	});

	it("noop names the provider in the error", async () => {
		await expect(
			(async () =>
				noopStorageProvider.getSignedUploadUrl({
					bucket: "x",
					key: "y",
					contentType: "image/webp",
				}))(),
		).rejects.toThrow("[storage:noop]");
	});
});
