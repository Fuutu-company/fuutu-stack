import { describe, expect, it } from "vitest";
import { AnthropicProvider } from "../providers/anthropic";
import { NoopProvider } from "../providers/noop";
import { OpenAIProvider } from "../providers/openai";
import { testAIProviderContract } from "./provider-contract.test";

testAIProviderContract("openai", () => new OpenAIProvider(), {
	behavior: "throws",
	throwsContains: "OpenAI provider not implemented",
});

testAIProviderContract("anthropic", () => new AnthropicProvider(), {
	behavior: "throws",
	throwsContains: "Anthropic provider not implemented",
});

testAIProviderContract("noop", () => new NoopProvider(), {
	behavior: "resolves",
});

describe("noop provider — returns empty responses, never throws", () => {
	it("chat() returns an empty assistant message", async () => {
		const provider = new NoopProvider();
		const response = await provider.chat([
			{ role: "user", content: "anything" },
		]);
		expect(response).toEqual({ content: "", role: "assistant" });
	});

	it("stream() returns an immediately-closed ReadableStream", async () => {
		const provider = new NoopProvider();
		const stream = await provider.stream([
			{ role: "user", content: "anything" },
		]);
		expect(stream).toBeInstanceOf(ReadableStream);
		const reader = stream.getReader();
		const { done } = await reader.read();
		expect(done).toBe(true);
	});
});

describe("skeleton providers — error messages name the provider", () => {
	it("openai names the provider in the error", async () => {
		const provider = new OpenAIProvider();
		await expect(
			(async () => provider.chat([{ role: "user", content: "x" }]))(),
		).rejects.toThrow("OpenAI provider not implemented");
	});

	it("anthropic names the provider in the error", async () => {
		const provider = new AnthropicProvider();
		await expect(
			(async () => provider.stream([{ role: "user", content: "x" }]))(),
		).rejects.toThrow("Anthropic provider not implemented");
	});
});
