import { describe, expect, it } from "vitest";
import { meilisearchProvider } from "../providers/meilisearch";
import { noopProvider } from "../providers/noop";
import { typesenseProvider } from "../providers/typesense";
import { testSearchProviderContract } from "./provider-contract.test";

testSearchProviderContract("meilisearch", () => meilisearchProvider, {
	searchBehavior: "throws",
	indexBehavior: "throws",
	throwsContains: "not implemented",
});

testSearchProviderContract("typesense", () => typesenseProvider, {
	searchBehavior: "throws",
	indexBehavior: "throws",
	throwsContains: "not implemented",
});

testSearchProviderContract("noop", () => noopProvider, {
	searchBehavior: "resolves",
	indexBehavior: "resolves",
	returnsEmpty: true,
});

describe("skeleton providers", () => {
	it("meilisearch search throws", async () => {
		await expect(meilisearchProvider.search({ text: "x" })).rejects.toThrow(
			"not implemented",
		);
	});

	it("meilisearch index throws", async () => {
		await expect(meilisearchProvider.index("c", [])).rejects.toThrow(
			"not implemented",
		);
	});

	it("typesense search throws", async () => {
		await expect(typesenseProvider.search({ text: "x" })).rejects.toThrow(
			"not implemented",
		);
	});

	it("typesense index throws", async () => {
		await expect(typesenseProvider.index("c", [])).rejects.toThrow(
			"not implemented",
		);
	});
});

describe("noop provider", () => {
	it("search returns empty array", async () => {
		const results = await noopProvider.search({ text: "anything" });
		expect(results).toEqual([]);
	});

	it("index resolves without side effects", async () => {
		await expect(noopProvider.index("c", [])).resolves.toBeUndefined();
	});
});
