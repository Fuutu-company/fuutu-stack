import { expectNonEmptyString } from "@fuutu/test-utils";
import { describe, expect, it } from "vitest";
import type { AIProvider } from "../types";

export interface AIProviderContractOptions {
	/** Whether the provider methods resolve or throw. */
	readonly behavior: "resolves" | "throws";
	/** Substring expected in thrown error messages (skeletons). */
	readonly throwsContains?: string;
}

const sampleMessages = [
	{ role: "user" as const, content: "Hello, what is Fuutu Stack?" },
];

/**
 * Shared contract every AIProvider must satisfy.
 * Called from one test file per provider so every swap candidate is covered.
 */
export function testAIProviderContract(
	name: string,
	createProvider: () => AIProvider,
	options: AIProviderContractOptions,
): void {
	describe(`AIProvider contract — ${name}`, () => {
		it("exposes a non-empty id", () => {
			const provider = createProvider();
			expectNonEmptyString(provider.id);
		});

		if (options.behavior === "resolves") {
			it("chat() accepts messages and returns an AIChatResponse", async () => {
				const provider = createProvider();
				const response = await provider.chat(sampleMessages);
				expect(typeof response.content).toBe("string");
				expect(response.role).toBe("assistant");
			});

			it("stream() returns a ReadableStream", async () => {
				const provider = createProvider();
				const stream = await provider.stream(sampleMessages);
				expect(stream).toBeInstanceOf(ReadableStream);
			});
		} else {
			it("chat() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.chat(sampleMessages))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});

			it("stream() throws", async () => {
				const provider = createProvider();
				await expect(
					(async () => provider.stream(sampleMessages))(),
				).rejects.toThrow(options.throwsContains ?? "not implemented");
			});
		}
	});
}
