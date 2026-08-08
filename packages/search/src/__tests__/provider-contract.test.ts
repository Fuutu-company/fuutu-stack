import { expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type { SearchProvider, SearchQuery } from "../types";

export interface SearchProviderContractOptions {
	readonly searchBehavior: "resolves" | "throws";
	readonly indexBehavior: "resolves" | "throws";
	readonly throwsContains?: string;
	readonly returnsEmpty?: boolean;
}

/**
 * Shared contract every SearchProvider must satisfy.
 */
export function testSearchProviderContract(
	name: string,
	createProvider: () => SearchProvider,
	options: SearchProviderContractOptions,
): void {
	describe(`SearchProvider contract — ${name}`, () => {
		const query: SearchQuery = {
			text: "test query",
			limit: 10,
		};

		it("exposes a non-empty id", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.id);
		});

		if (options.searchBehavior === "resolves") {
			it("search() resolves with an array", async () => {
				const provider = createProvider();
				const results = await provider.search(query);
				expect(Array.isArray(results)).toBe(true);
				if (options.returnsEmpty) {
					expect(results).toEqual([]);
				}
			});
		} else {
			it("search() throws", async () => {
				const provider = createProvider();
				await expect(provider.search(query)).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});
		}

		if (options.indexBehavior === "resolves") {
			it("index() resolves", async () => {
				const provider = createProvider();
				await expect(provider.index("test", [])).resolves.toBeUndefined();
			});
		} else {
			it("index() throws", async () => {
				const provider = createProvider();
				await expect(provider.index("test", [])).rejects.toThrow(
					options.throwsContains ?? "not implemented",
				);
			});
		}
	});
}
