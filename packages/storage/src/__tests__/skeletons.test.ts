import { describe, expect, it } from "vitest";
import {
	noopStorageProvider,
	supabaseStorageProvider,
} from "../providers/skeletons";
import { testStorageProviderContract } from "./provider-contract.test";

testStorageProviderContract("supabase", () => supabaseStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
});

testStorageProviderContract("noop", () => noopStorageProvider, {
	behavior: "throws",
	throwsContains: "not implemented",
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
