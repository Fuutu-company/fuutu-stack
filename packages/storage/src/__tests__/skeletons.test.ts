import { describe, expect, it } from "vitest";
import {
	noopStorageProvider,
	r2StorageProvider,
	supabaseStorageProvider,
} from "../providers/skeletons";
import { testStorageProviderContract } from "./provider-contract.test";

testStorageProviderContract("r2", () => r2StorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testStorageProviderContract("supabase", () => supabaseStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testStorageProviderContract("noop", () => noopStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

describe("storage skeletons — error messages name the provider", () => {
	it("r2 names the provider in the error", async () => {
		await expect(
			(async () =>
				r2StorageProvider.getSignedUploadUrl({
					bucket: "x",
					key: "y",
					contentType: "image/webp",
				}))(),
		).rejects.toThrow("[storage:r2]");
	});

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
